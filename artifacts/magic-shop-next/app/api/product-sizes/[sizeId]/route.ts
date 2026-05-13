import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { insertProductSizeSchema } from "@workspace/db/schema";

async function getUser() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.userId) return null;
  return await storage.getUser(session.userId);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sizeId: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "sales_director") {
      return NextResponse.json(
        { error: "Nemate ovlaštenje za izmjenu veličina" },
        { status: 403 },
      );
    }

    const { sizeId: sizeIdParam } = await params;
    const sizeId = parseInt(sizeIdParam);
    if (isNaN(sizeId)) {
      return NextResponse.json({ error: "Nevažeći ID veličine" }, { status: 400 });
    }

    const existing = await storage.getProductSize(sizeId);
    if (!existing) {
      return NextResponse.json({ error: "Size not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = insertProductSizeSchema.omit({ productId: true }).partial().parse(body);

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Naziv veličine ne smije biti prazan" },
          { status: 400 },
        );
      }
      const others = await storage.getProductSizes(existing.productId);
      const dup = others.find(
        (s) => s.id !== sizeId && s.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (dup) {
        return NextResponse.json(
          { error: `Veličina "${trimmed}" već postoji za ovaj artikal` },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }

    const updated = await storage.updateProductSize(sizeId, data);
    if (!updated) {
      return NextResponse.json({ error: "Size not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating product size:", error);
    return NextResponse.json({ error: "Failed to update product size" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sizeId: string }> },
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    if (user.role !== "admin" && user.role !== "sales_director") {
      return NextResponse.json(
        { error: "Nemate ovlaštenje za izmjenu veličina" },
        { status: 403 },
      );
    }

    const { sizeId: sizeIdParam } = await params;
    const sizeId = parseInt(sizeIdParam);
    if (isNaN(sizeId)) {
      return NextResponse.json({ error: "Nevažeći ID veličine" }, { status: 400 });
    }

    const existing = await storage.getProductSize(sizeId);
    if (!existing) {
      return NextResponse.json({ error: "Size not found" }, { status: 404 });
    }

    const result = await storage.deleteProductSize(sizeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error deleting product size:", error);
    return NextResponse.json({ error: "Failed to delete product size" }, { status: 500 });
  }
}
