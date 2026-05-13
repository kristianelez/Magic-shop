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
      return NextResponse.json({ error: "Nevažeći ID kupca" }, { status: 400 });
    }

    const customer = await storage.getCustomer(id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const stats = await storage.getCustomerStats(id, user.id, user.role);
    const activities = await storage.getActivitiesByCustomer(id);
    const sales = await storage.getSalesByCustomer(id, user.id, user.role);
    const lastContact =
      activities.length > 0
        ? new Date(activities[0].createdAt).toLocaleDateString("bs-BA")
        : undefined;

    return NextResponse.json({
      ...customer,
      totalPurchases: stats.totalPurchases,
      lastContact,
      favoriteProducts: stats.favoriteProducts,
      activities,
      sales,
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
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
      return NextResponse.json({ error: "Nevažeći ID kupca" }, { status: 400 });
    }

    const existing = await storage.getCustomer(id);
    if (!existing) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates = insertCustomerSchema.partial().parse(body);

    const mergedData: Record<string, unknown> = { ...existing };
    for (const key in updates) {
      mergedData[key] = updates[key as keyof typeof updates];
    }
    delete mergedData.id;
    delete mergedData.createdAt;

    const customer = await storage.updateCustomer(id, mergedData as Parameters<typeof storage.updateCustomer>[1]);
    return NextResponse.json(customer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating customer:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
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
      return NextResponse.json({ error: "Nevažeći ID kupca" }, { status: 400 });
    }

    const deleted = await storage.deleteCustomer(id);
    if (!deleted) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}
