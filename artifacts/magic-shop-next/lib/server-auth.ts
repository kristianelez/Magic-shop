import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionOptions } from "@/lib/auth";
import { storage } from "@/lib/storage";
import type { User } from "@workspace/db/schema";

export async function requireServerUser(): Promise<User> {
  const session = await getIronSession(await cookies(), sessionOptions);
  if (!session.userId) redirect("/login");
  const user = await storage.getUser(session.userId);
  if (!user) redirect("/login");
  return user;
}
