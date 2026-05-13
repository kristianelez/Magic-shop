import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";

async function getUser() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return null;
  return await storage.getUser(session.userId);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const { offerId, productId, quantity, price, category } = await request.json();
    const item = await storage.addOfferItem({
      offerId,
      productId,
      quantity,
      price,
      category,
      discount: "0",
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Error adding offer item:", error);
    return NextResponse.json({ error: "Failed to add offer item" }, { status: 500 });
  }
}
