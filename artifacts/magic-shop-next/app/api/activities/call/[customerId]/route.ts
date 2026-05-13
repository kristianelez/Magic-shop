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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const { customerId: customerIdParam } = await params;
    const customerId = parseInt(customerIdParam);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Nevažeći ID kupca" }, { status: 400 });
    }

    const customer = await storage.getCustomer(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const activity = await storage.createActivity({
      customerId,
      type: "call",
      notes: "Poziv komercijaliste",
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Error recording call activity:", error);
    return NextResponse.json({ error: "Failed to record call" }, { status: 500 });
  }
}
