import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const storeRows = await db.select().from(stores).orderBy(asc(stores.name));
    return NextResponse.json({ stores: storeRows });
  } catch (error) {
    console.error("Stores error:", error);
    return NextResponse.json({ error: "Failed to fetch stores" }, { status: 500 });
  }
}
