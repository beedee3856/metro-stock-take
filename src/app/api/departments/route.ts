import { NextResponse } from "next/server";
import { db } from "@/db";
import { departments, categories, stores } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deptRows = await db.select().from(departments).orderBy(asc(departments.name));
    const catRows = await db.select().from(categories).orderBy(asc(categories.name));

    return NextResponse.json({ departments: deptRows, categories: catRows });
  } catch (error) {
    console.error("Departments error:", error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}
