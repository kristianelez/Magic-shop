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
      return NextResponse.json({ error: "Nevažeći ID ponude" }, { status: 400 });
    }

    const offer = await storage.getOffer(id);
    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(offer);
  } catch (error) {
    console.error("Error fetching offer:", error);
    return NextResponse.json({ error: "Failed to fetch offer" }, { status: 500 });
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
      return NextResponse.json({ error: "Nevažeći ID ponude" }, { status: 400 });
    }

    const { customerId, totalAmount, status, items } = await request.json();

    const offer = await storage.updateOffer(id, {
      customerId,
      totalAmount,
      status,
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (items && items.length > 0) {
      await storage.deleteOfferItems(id);
      for (const item of items) {
        await storage.addOfferItem({
          offerId: id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount || "0",
          category: item.category,
          productName: item.productName,
        });
      }
    }

    const updatedOffer = await storage.getOffer(id);
    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error("Error updating offer:", error);
    return NextResponse.json({ error: "Failed to update offer" }, { status: 500 });
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
      return NextResponse.json({ error: "Nevažeći ID ponude" }, { status: 400 });
    }

    const deleted = await storage.deleteOffer(id);
    if (!deleted) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting offer:", error);
    return NextResponse.json({ error: "Failed to delete offer" }, { status: 500 });
  }
}
