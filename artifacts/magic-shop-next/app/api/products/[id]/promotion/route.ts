import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { setPromotionSchema, isPromotionActive } from "@workspace/db/schema";

async function getUser() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return null;
  return await storage.getUser(session.userId);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "sales_director") {
      return NextResponse.json(
        { error: "Nemate ovlaštenje za upravljanje akcijama" },
        { status: 403 },
      );
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Nevažeći ID artikla" }, { status: 400 });
    }

    const product = await storage.getProduct(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = setPromotionSchema.parse(body);

    const promoPriceNum = parseFloat(data.promoPrice);
    const regularPriceNum = parseFloat(product.price);

    if (!isFinite(promoPriceNum) || promoPriceNum <= 0) {
      return NextResponse.json(
        { error: "Akcijska cijena mora biti pozitivan broj" },
        { status: 400 },
      );
    }
    if (promoPriceNum >= regularPriceNum) {
      return NextResponse.json(
        { error: "Akcijska cijena mora biti manja od redovne cijene" },
        { status: 400 },
      );
    }

    const start = new Date(data.promoStartDate);
    const end = new Date(data.promoEndDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Neispravan datum akcije" }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json(
        { error: "Datum kraja mora biti poslije datuma početka" },
        { status: 400 },
      );
    }

    const updated = await storage.setProductPromotion(id, {
      promoPrice: data.promoPrice,
      promoStartDate: start,
      promoEndDate: end,
      promoNote: data.promoNote ?? null,
    });

    return NextResponse.json({ ...updated, promoActive: isPromotionActive(updated!) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error setting promotion:", error);
    return NextResponse.json({ error: "Failed to set promotion" }, { status: 500 });
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

    if (user.role !== "admin" && user.role !== "sales_director") {
      return NextResponse.json(
        { error: "Nemate ovlaštenje za upravljanje akcijama" },
        { status: 403 },
      );
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Nevažeći ID artikla" }, { status: 400 });
    }

    const updated = await storage.clearProductPromotion(id);
    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ ...updated, promoActive: false });
  } catch (error) {
    console.error("Error clearing promotion:", error);
    return NextResponse.json({ error: "Failed to clear promotion" }, { status: 500 });
  }
}
