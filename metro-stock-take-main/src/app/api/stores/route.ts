import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";

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

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can save stores" }, { status: 403 });
    }

    const { name } = await req.json();
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Store name is required" }, { status: 400 });
    }

    const existing = await db.select().from(stores).where(eq(stores.name, trimmedName)).limit(1);
    if (existing[0]) {
      return NextResponse.json({ success: true, store: existing[0] });
    }

    const codeBase = trimmedName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 16).toUpperCase() || "STORE";
    const inserted = await db
      .insert(stores)
      .values({
        code: `${codeBase}-${Date.now().toString().slice(-6)}`,
        name: trimmedName,
      })
      .returning();

    return NextResponse.json({ success: true, store: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("Store save error:", error);
    return NextResponse.json({ error: "Failed to save store" }, { status: 500 });
  }
}
