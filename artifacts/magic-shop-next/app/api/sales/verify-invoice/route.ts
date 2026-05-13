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

    const { saleIds, verified } = await request.json();

    if (!Array.isArray(saleIds) || saleIds.length === 0) {
      return NextResponse.json(
        { error: "saleIds must be a non-empty array" },
        { status: 400 },
      );
    }

    const verifiedValue = verified === true || verified === "true" ? "true" : "false";

    for (const saleId of saleIds) {
      await storage.updateSale(parseInt(saleId), { invoiceVerified: verifiedValue } as Parameters<typeof storage.updateSale>[1]);
    }

    return NextResponse.json({ success: true, verified: verifiedValue });
  } catch (error) {
    console.error("Error updating invoice verification:", error);
    return NextResponse.json(
      { error: "Failed to update invoice verification" },
      { status: 500 },
    );
  }
}
