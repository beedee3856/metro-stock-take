import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations, departments, stores } from "@/db/schema";
import { eq, or, ilike, and, asc } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim();
    const departmentId = searchParams.get("departmentId");
    const storeId = searchParams.get("storeId");
    const status = searchParams.get("status");

    const conditions = [];

    if (query) {
      conditions.push(
        or(
          ilike(locations.locationCode, `%${query}%`),
          ilike(locations.locationName, `%${query}%`),
          ilike(locations.aisle, `%${query}%`),
          ilike(locations.barcode, `%${query}%`)
        )
      );
    }

    if (departmentId && departmentId !== "ALL") {
      conditions.push(eq(locations.departmentId, departmentId));
    }

    if (storeId && storeId !== "ALL") {
      conditions.push(eq(locations.storeId, storeId));
    }

    if (status && status !== "ALL") {
      conditions.push(eq(locations.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: locations.id,
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        aisle: locations.aisle,
        shelfSection: locations.shelfSection,
        barcode: locations.barcode,
        description: locations.description,
        status: locations.status,
        createdAt: locations.createdAt,
        storeId: locations.storeId,
        storeName: stores.name,
        departmentId: locations.departmentId,
        departmentName: departments.name,
      })
      .from(locations)
      .leftJoin(stores, eq(locations.storeId, stores.id))
      .leftJoin(departments, eq(locations.departmentId, departments.id))
      .where(whereClause)
      .orderBy(asc(locations.locationCode));

    return NextResponse.json({ locations: rows });
  } catch (error) {
    console.error("Locations fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_LOCATIONS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can create locations" }, { status: 403 });
    }

    const body = await req.json();
    const { locationCode, locationName, aisle, shelfSection, barcode, description, departmentId, storeId, status = "ACTIVE" } = body;

    if (!locationCode?.trim()) {
      return NextResponse.json({ error: "Location Code is required" }, { status: 400 });
    }
    if (!locationName?.trim()) {
      return NextResponse.json({ error: "Location Name is required" }, { status: 400 });
    }

    // Check duplicate code
    const existing = await db.select().from(locations).where(eq(locations.locationCode, locationCode.trim())).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: `Location Code '${locationCode}' already exists.` }, { status: 409 });
    }

    const inserted = await db
      .insert(locations)
      .values({
        locationCode: locationCode.trim().toUpperCase(),
        locationName: locationName.trim(),
        aisle: aisle?.trim() || null,
        shelfSection: shelfSection?.trim() || null,
        barcode: barcode?.trim() || `LOC-${locationCode.trim().toUpperCase()}`,
        description: description?.trim() || null,
        departmentId: departmentId || null,
        storeId: storeId || user.storeId || null,
        status: status || "ACTIVE",
      })
      .returning();

    const newLoc = inserted[0];

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "LOCATION_CREATE",
      entityType: "LOCATION",
      entityId: newLoc.id,
      newValue: { code: newLoc.locationCode, name: newLoc.locationName },
    });

    return NextResponse.json({ success: true, location: newLoc }, { status: 201 });
  } catch (error) {
    console.error("Location creation error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
