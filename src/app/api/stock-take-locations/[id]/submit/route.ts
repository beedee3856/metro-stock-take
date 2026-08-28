import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakeLocations, stockTakes, stockCounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { overrideIncomplete = false } = body;

    const stlRows = await db.select().from(stockTakeLocations).where(eq(stockTakeLocations.id, id)).limit(1);
    if (stlRows.length === 0) {
      return NextResponse.json({ error: "Stock Take Location record not found" }, { status: 404 });
    }
    const stl = stlRows[0];

    // Authorization
    if (user.role === "STOCK_TAKER" && stl.assignedUserId !== user.id) {
      return NextResponse.json({ error: "You are not authorized to submit this location" }, { status: 403 });
    }

    const stRows = await db.select().from(stockTakes).where(eq(stockTakes.id, stl.stockTakeId)).limit(1);
    const st = stRows[0];

    // Count physical count lines recorded for this location
    const counts = await db.select().from(stockCounts).where(eq(stockCounts.stockTakeLocationId, id));

    const expected = stl.expectedItemsCount;
    const counted = counts.length;
    const uncounted = Math.max(0, expected - counted);

    if (st?.require100Percent && uncounted > 0 && !overrideIncomplete) {
      return NextResponse.json(
        {
          canSubmit: false,
          error: `Incomplete count: ${uncounted} item(s) have not been counted in this location. 100% counting is required by policy.`,
          summary: {
            expectedItems: expected,
            countedItems: counted,
            uncountedItems: uncounted,
          },
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await db
      .update(stockTakeLocations)
      .set({
        status: "SUBMITTED",
        submittedAt: now,
        countedItemsCount: counted,
        updatedAt: now,
      })
      .where(eq(stockTakeLocations.id, id))
      .returning();

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "LOCATION_SUBMITTED",
      entityType: "STOCK_TAKE_LOCATION",
      entityId: id,
      newValue: {
        status: "SUBMITTED",
        expectedItems: expected,
        countedItems: counted,
        uncountedItems: uncounted,
      },
      reason: `Location submitted by ${user.fullName}`,
    });

    return NextResponse.json({
      success: true,
      message: "Location successfully submitted for supervisor review.",
      location: updated[0],
    });
  } catch (error) {
    console.error("Location submit error:", error);
    return NextResponse.json({ error: "Failed to submit location" }, { status: 500 });
  }
}
