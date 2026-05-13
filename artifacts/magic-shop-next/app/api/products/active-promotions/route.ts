import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { isPromotionActive } from "@workspace/db/schema";

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

    const all = await storage.getProducts();
    const now = new Date();
    const active = all
      .filter((p) => isPromotionActive(p, now))
      .map((p) => ({ ...p, promoActive: true }));
    return NextResponse.json(active);
  } catch (error) {
    console.error("Error fetching active promotions:", error);
    return NextResponse.json({ error: "Failed to fetch active promotions" }, { status: 500 });
  }
}
