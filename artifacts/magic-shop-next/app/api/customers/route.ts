import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { insertCustomerSchema } from "@workspace/db/schema";

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

    const customersWithStats = await storage.getCustomersWithStats(user.id, user.role);
    return NextResponse.json(customersWithStats);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const body = await request.json();
    const customerData = insertCustomerSchema.parse(body);
    const customerWithSalesPerson = {
      ...customerData,
      salesPersonId: customerData.salesPersonId || user.id,
    };
    const customer = await storage.createCustomer(customerWithSalesPerson);
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
