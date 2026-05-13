import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "Korisničko ime i šifra su obavezni" },
        { status: 400 },
      );
    }

    const user = await storage.getUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { message: "Neispravno korisničko ime ili šifra" },
        { status: 401 },
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { message: "Neispravno korisničko ime ili šifra" },
        { status: 401 },
      );
    }

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = user.id;
    await session.save();

    const { password: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Greška pri prijavljivanju" }, { status: 500 });
  }
}
