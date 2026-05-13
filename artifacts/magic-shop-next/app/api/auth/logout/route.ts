import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.destroy();
    return NextResponse.json({ message: "Uspješno ste se odjavili" });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ message: "Greška pri odjavljivanju" }, { status: 500 });
  }
}
