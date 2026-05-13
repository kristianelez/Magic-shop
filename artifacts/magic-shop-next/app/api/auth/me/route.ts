import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";

export async function GET() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.userId) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const user = await storage.getUser(session.userId);

    if (!user) {
      return NextResponse.json({ message: "Korisnik nije pronađen" }, { status: 401 });
    }

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json({ message: "Greška pri dohvatanju korisnika" }, { status: 500 });
  }
}
