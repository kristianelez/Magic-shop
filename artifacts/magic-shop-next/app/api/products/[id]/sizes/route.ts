import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { updateProductSizesSchema, insertProductSizeSchema } from "@workspace/db/schema";

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
      return NextResponse.json({ error: "Nevažeći ID artikla" }, { status: 400 });
    }

    const sizes = await storage.getProductSizes(id);
    return NextResponse.json(sizes);
  } catch (error) {
    console.error("Error fetching product sizes:", error);
    return NextResponse.json({ error: "Failed to fetch product sizes" }, { status: 500 });
  }
}

export async function PUT(
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
        { error: "Nemate ovlaštenje za izmjenu veličina" },
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
    const data = updateProductSizesSchema.parse(body);

    const seen = new Set<string>();
    for (const s of data.sizes) {
      const key = s.name.trim().toLowerCase();
      if (!key) {
        return NextResponse.json(
          { error: "Naziv veličine ne smije biti prazan" },
          { status: 400 },
        );
      }
      if (seen.has(key)) {
        return NextResponse.json(
          { error: `Naziv veličine "${s.name}" se ponavlja` },
          { status: 400 },
        );
      }
      seen.add(key);
    }

    const sizes = await storage.replaceProductSizes(
      id,
      data.sizes.map((s) => ({ ...s, name: s.name.trim() })),
    );
    return NextResponse.json(sizes);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating product sizes:", error);
    return NextResponse.json({ error: "Failed to update product sizes" }, { status: 500 });
  }
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
        { error: "Nemate ovlaštenje za izmjenu veličina" },
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
    const data = insertProductSizeSchema.omit({ productId: true }).parse(body);

    const existing = await storage.getProductSizes(id);
    const nameKey = data.name.trim().toLowerCase();
    if (existing.some((s) => s.name.trim().toLowerCase() === nameKey)) {
      return NextResponse.json(
        { error: `Veličina "${data.name}" već postoji za ovaj artikal` },
        { status: 400 },
      );
    }

    const created = await storage.createProductSize(id, {
      name: data.name.trim(),
      stock: data.stock ?? 0,
      sortOrder: data.sortOrder,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating product size:", error);
    return NextResponse.json({ error: "Failed to create product size" }, { status: 500 });
  }
}
