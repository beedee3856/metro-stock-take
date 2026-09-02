import { NextResponse } from "next/server";
import { db } from "@/db";
import { locations, departments, stores } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_LOCATIONS")) {
      return NextResponse.json({ error: "Forbidden: You don't have permission to manage locations" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { locationCode, locationName, aisle, shelfSection, barcode, description, departmentId, storeId, status } = body;

    // Check if location exists
    const existing = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const oldLocation = existing[0];

    if (!locationCode?.trim()) {
      return NextResponse.json({ error: "Location Code is required" }, { status: 400 });
    }
    if (!locationName?.trim()) {
      return NextResponse.json({ error: "Location Name is required" }, { status: 400 });
    }

    // Check duplicate code (excluding current location)
    const duplicateCheck = await db
      .select()
      .from(locations)
      .where(eq(locations.locationCode, locationCode.trim().toUpperCase()))
      .limit(1);

    if (duplicateCheck.length > 0 && duplicateCheck[0].id !== id) {
      return NextResponse.json({ error: `Location Code '${locationCode}' already exists.` }, { status: 409 });
    }

    const updated = await db
      .update(locations)
      .set({
        locationCode: locationCode.trim().toUpperCase(),
        locationName: locationName.trim(),
        aisle: aisle?.trim() || null,
        shelfSection: shelfSection?.trim() || null,
        barcode: barcode?.trim() || `LOC-${locationCode.trim().toUpperCase()}`,
        description: description?.trim() || null,
        departmentId: departmentId || null,
        storeId: storeId || null,
        status: status || oldLocation.status,
      })
      .where(eq(locations.id, id))
      .returning();

    const updatedLocation = updated[0];

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "LOCATION_UPDATE",
      entityType: "LOCATION",
      entityId: id,
      previousValue: { code: oldLocation.locationCode, name: oldLocation.locationName },
      newValue: { code: updatedLocation.locationCode, name: updatedLocation.locationName },
    });

    return NextResponse.json({ success: true, location: updatedLocation });
  } catch (error) {
    console.error("Location update error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}
