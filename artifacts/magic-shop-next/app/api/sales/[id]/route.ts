import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { insertSaleSchema, type InsertSale } from "@workspace/db/schema";

async function getUser() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return null;
  return await storage.getUser(session.userId);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
    }

    const sale = await storage.getSale(id);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Komercijalisti smiju vidjeti samo svoje prodaje.
    if (
      user.role !== "admin" &&
      user.role !== "sales_director" &&
      user.role !== "sales_manager" &&
      sale.salesPersonId !== user.id
    ) {
      return NextResponse.json(
        { error: "Nemate pristup ovoj narudžbi" },
        { status: 403 },
      );
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error("Error fetching sale:", error);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
    }

    const body = await request.json();
    const { createdAt: createdAtRaw, ...rest } = body ?? {};
    const saleData: Partial<InsertSale> & { createdAt?: Date } =
      insertSaleSchema.partial().parse(rest);

    const existingSale = await storage.getSale(id);
    if (!existingSale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Komercijalisti smiju mijenjati samo svoje prodaje.
    {
      const role = user.role;
      if (
        role !== "admin" &&
        role !== "sales_director" &&
        role !== "sales_manager" &&
        existingSale.salesPersonId !== user.id
      ) {
        return NextResponse.json(
          { error: "Nemate dozvolu za izmjenu ove narudžbe" },
          { status: 403 },
        );
      }
    }

    // Validacija veličine pri PATCH-u prodaje
    const effectiveProductId = saleData.productId ?? existingSale.productId;
    const effectiveSizeId =
      saleData.sizeId !== undefined ? saleData.sizeId : existingSale.sizeId;
    const productSizesList = await storage.getProductSizes(effectiveProductId);

    if (productSizesList.length > 0) {
      if (effectiveSizeId === null || effectiveSizeId === undefined) {
        return NextResponse.json(
          { error: "Ovaj artikal ima definisane veličine — odaberite veličinu za prodaju" },
          { status: 400 },
        );
      }
      const match = productSizesList.find((s) => s.id === effectiveSizeId);
      if (!match) {
        return NextResponse.json(
          { error: "Odabrana veličina ne pripada ovom artiklu" },
          { status: 400 },
        );
      }
    } else if (effectiveSizeId !== null && effectiveSizeId !== undefined) {
      return NextResponse.json(
        { error: "Ovaj artikal nema definisane veličine" },
        { status: 400 },
      );
    }

    // Za PATCH - samo admin/sales_director mogu mijenjati datum
    if (createdAtRaw !== undefined && createdAtRaw !== null && createdAtRaw !== "") {
      const role = user.role;
      if (role !== "admin" && role !== "sales_director") {
        return NextResponse.json(
          { error: "Nemate dozvolu za izmjenu datuma narudžbe" },
          { status: 403 },
        );
      }
      const parsed = new Date(createdAtRaw);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Nevažeći datum narudžbe" }, { status: 400 });
      }
      saleData.createdAt = parsed;
    }

    const sale = await storage.updateSale(id, saleData);
    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating sale:", error);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid sale id" }, { status: 400 });
    }

    const existing = await storage.getSale(id);
    if (!existing) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Komercijalisti smiju brisati samo svoje prodaje.
    const role = user.role;
    if (
      role !== "admin" &&
      role !== "sales_director" &&
      role !== "sales_manager" &&
      existing.salesPersonId !== user.id
    ) {
      return NextResponse.json(
        { error: "Nemate dozvolu za brisanje ove narudžbe" },
        { status: 403 },
      );
    }

    const deleted = await storage.deleteSale(id);
    if (!deleted) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting sale:", error);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
