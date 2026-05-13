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

export async function GET(
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

    const discounts = await storage.getLastDiscountsByCustomer(
      customerId,
      user.id,
      user.role,
    );
    return NextResponse.json(discounts);
  } catch (error) {
    console.error("Error fetching last discounts:", error);
    return NextResponse.json({ error: "Failed to fetch last discounts" }, { status: 500 });
  }
}
