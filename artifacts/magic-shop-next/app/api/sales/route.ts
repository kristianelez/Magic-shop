import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { insertSaleSchema, type InsertSale } from "@workspace/db/schema";
import { sendNewOrderEmail } from "@/lib/email";

async function getUser() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return null;
  return await storage.getUser(session.userId);
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const sales = await storage.getSales(user.id, user.role);
    return NextResponse.json(sales);
  } catch (error) {
    console.error("Error fetching sales:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const body = await request.json();
    const { createdAt: createdAtRaw, ...rest } = body ?? {};
    const saleData = insertSaleSchema.parse(rest);

    // Validacija veličine: ako artikal ima definisane veličine,
    // sizeId je obavezan; ako je poslan, mora pripadati istom artiklu.
    const productSizesList = await storage.getProductSizes(saleData.productId);
    if (productSizesList.length > 0) {
      if (!saleData.sizeId) {
        return NextResponse.json(
          { error: "Ovaj artikal ima veličine — odaberite veličinu" },
          { status: 400 },
        );
      }
      const match = productSizesList.find((s) => s.id === saleData.sizeId);
      if (!match) {
        return NextResponse.json(
          { error: "Odabrana veličina ne pripada ovom artiklu" },
          { status: 400 },
        );
      }
    } else if (saleData.sizeId) {
      return NextResponse.json(
        { error: "Ovaj artikal nema veličine" },
        { status: 400 },
      );
    }

    const saleWithSalesPerson: InsertSale & { createdAt?: Date } = {
      ...saleData,
      salesPersonId: user.id,
    };

    // Datum prodaje smiju postaviti svi autentikovani korisnici
    if (createdAtRaw !== undefined && createdAtRaw !== null && createdAtRaw !== "") {
      const parsed = new Date(createdAtRaw);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Nevažeći datum narudžbe" }, { status: 400 });
      }
      saleWithSalesPerson.createdAt = parsed;
    }

    const sale = await storage.createSale(saleWithSalesPerson);

    // Fire-and-forget email notification (no push notifications)
    (async () => {
      try {
        const [customer, product] = await Promise.all([
          storage.getCustomer(sale.customerId),
          storage.getProduct(sale.productId),
        ]);
        let sizeName: string | null = null;
        if (sale.sizeId) {
          const sz = await storage.getProductSize(sale.sizeId);
          sizeName = sz?.name ?? null;
        }
        const unitPrice = product?.promoPrice ? product.promoPrice : product?.price ?? "0";
        const customerName = customer?.name ?? `#${sale.customerId}`;
        const customerCompany = customer?.company ?? null;
        const salesPersonName = user?.fullName ?? user?.username ?? "—";
        const productName = product?.name ?? `#${sale.productId}`;

        await sendNewOrderEmail({
          customerName,
          customerCompany,
          salesPersonName,
          productName,
          sizeName,
          quantity: sale.quantity,
          unitPrice,
          discount: sale.discount ?? "0",
          totalAmount: sale.totalAmount,
          note: null,
          createdAt: sale.createdAt ?? new Date(),
        });
      } catch (e) {
        console.error("[notify] Error sending new order email:", e);
      }
    })();

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating sale:", error);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
