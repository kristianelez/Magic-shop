import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET() {
  try {
    const allUsers = await storage.getUsers();
    const usersWithoutPasswords = allUsers.map(({ password: _, ...user }) => user);
    return NextResponse.json(usersWithoutPasswords);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
