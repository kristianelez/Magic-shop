import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { insertActivitySchema } from "@workspace/db/schema";

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

    let activities;
    if (user.role === "admin") {
      activities = await storage.getActivities();
    } else {
      const allActivities = await storage.getActivities();
      const myCustomers = await storage.getCustomers(user.id, user.role);
      const myCustomerIds = new Set(myCustomers.map((c) => c.id));
      activities = allActivities.filter((a) => myCustomerIds.has(a.customerId));
    }

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ message: "Niste prijavljeni" }, { status: 401 });
    }

    const body = await request.json();
    const activityData = insertActivitySchema.parse(body);
    const activity = await storage.createActivity(activityData);
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating activity:", error);
    return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
  }
}
