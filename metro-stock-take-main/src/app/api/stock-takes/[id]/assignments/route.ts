import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stockTakeLocations,
  stockTakes,
  locations,
  items,
  users,
  stockCounts,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "ASSIGN_STOCK_TAKERS")) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators and supervisors can assign stock takers" },
        { status: 403 }
      );
    }

    const { id: stockTakeId } = await params;
    const body = await req.json();
    const { stockTakeLocationId, locationId, assignedUserId, verifierUserId, notes } = body;

    // Accept EITHER the session-row id OR the master location id (Quick Assignment sends locationId)
    if (!stockTakeLocationId && !locationId) {
      return NextResponse.json(
        { error: "Either stockTakeLocationId or locationId is required" },
        { status: 400 }
      );
    }

    const stRows = await db
      .select()
      .from(stockTakes)
      .where(eq(stockTakes.id, stockTakeId))
      .limit(1);
    if (stRows.length === 0) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }
    const stockTake = stRows[0];

    if (stockTake.isLocked || ["FINALIZED", "CANCELLED"].includes(stockTake.status)) {
      return NextResponse.json(
        { error: "This stock take is locked, finalized or cancelled — assignments cannot change." },
        { status: 423 }
      );
    }

    // Resolve the stock_take_locations row from either identifier
    let stl: (typeof stockTakeLocations.$inferSelect) | null = null;

    if (stockTakeLocationId) {
      const rows = await db
        .select()
        .from(stockTakeLocations)
        .where(
          and(eq(stockTakeLocations.id, stockTakeLocationId), eq(stockTakeLocations.stockTakeId, stockTakeId))
        )
        .limit(1);
      stl = rows[0] || null;
    }

    if (!stl && locationId) {
      const rows = await db
        .select()
        .from(stockTakeLocations)
        .where(
          and(eq(stockTakeLocations.locationId, locationId), eq(stockTakeLocations.stockTakeId, stockTakeId))
        )
        .limit(1);
      stl = rows[0] || null;
    }

    // Master location not yet part of this session? Attach it now.
    if (!stl) {
      if (!locationId) {
        return NextResponse.json(
          { error: "This location is not part of the stock take and no locationId was provided" },
          { status: 400 }
        );
      }
      const locRows = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (locRows.length === 0) {
        return NextResponse.json({ error: "Location not found" }, { status: 404 });
      }

      const expected = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(items)
        .where(and(eq(items.defaultLocationId, locationId), eq(items.isActive, true)));

      const inserted = await db
        .insert(stockTakeLocations)
        .values({
          stockTakeId,
          locationId,
          status: "NOT_ASSIGNED",
          expectedItemsCount: expected[0]?.count || 0,
          countedItemsCount: 0,
        })
        .returning();
      stl = inserted[0];

      await logAudit({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: "STOCK_TAKE_LOCATION_ADDED",
        entityType: "STOCK_TAKE_LOCATION",
        entityId: stl.id,
        newValue: { stockTakeNumber: stockTake.stockTakeNumber, locationCode: locRows[0].locationCode },
        reason: "Location attached to stock take during assignment",
      });
    }

    const prev = stl;
    const now = new Date();

    let newStatus = prev.status;
    let resetCycle = false;

    if (!assignedUserId) {
      newStatus = "NOT_ASSIGNED"; // release the location
    } else if (["APPROVED", "COMPLETED"].includes(prev.status)) {
      // Re-opening an approved/completed location starts a fresh counting cycle
      newStatus = "ASSIGNED";
      resetCycle = true;
    } else if (prev.status === "NOT_ASSIGNED") {
      newStatus = "ASSIGNED";
    }

    if (resetCycle) {
      const oldCounts = await db
        .select({
          id: stockCounts.id,
          itemCode: items.itemCode,
          itemName: items.itemName,
          physicalQuantity: stockCounts.physicalQuantity,
          varianceQuantity: stockCounts.varianceQuantity,
        })
        .from(stockCounts)
        .leftJoin(items, eq(stockCounts.itemId, items.id))
        .where(eq(stockCounts.stockTakeLocationId, prev.id));

      if (oldCounts.length > 0) {
        await db.delete(stockCounts).where(eq(stockCounts.stockTakeLocationId, prev.id));
        await logAudit({
          userId: user.id,
          userName: user.fullName,
          userRole: user.role,
          action: "LOCATION_CYCLE_RESET",
          entityType: "STOCK_TAKE_LOCATION",
          entityId: prev.id,
          previousValue: oldCounts,
          reason: "Previous approved cycle cleared so the location can be counted again",
        });
      }
    }

    const updated = await db
      .update(stockTakeLocations)
      .set({
        assignedUserId: assignedUserId || null,
        verifierUserId: verifierUserId || prev.verifierUserId,
        status: newStatus,
        countedItemsCount: resetCycle ? 0 : prev.countedItemsCount,
        startedAt: resetCycle ? null : prev.startedAt,
        submittedAt: resetCycle ? null : prev.submittedAt,
        approvedAt: resetCycle ? null : prev.approvedAt,
        approvedBy: resetCycle ? null : prev.approvedBy,
        notes: notes !== undefined ? notes : prev.notes,
        updatedAt: now,
      })
      .where(eq(stockTakeLocations.id, prev.id))
      .returning();

    let assignedUserName = "Unassigned";
    if (assignedUserId) {
      const u = await db.select().from(users).where(eq(users.id, assignedUserId)).limit(1);
      if (u.length > 0) assignedUserName = u[0].fullName;
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "ASSIGN_STOCK_TAKER",
      entityType: "STOCK_TAKE_LOCATION",
      entityId: prev.id,
      previousValue: { assignedUserId: prev.assignedUserId, status: prev.status },
      newValue: { assignedUserId, assignedUserName, status: newStatus, resetCycle },
      reason: assignedUserId
        ? `Assigned location to ${assignedUserName}`
        : "Location released (unassigned)",
    });

    return NextResponse.json({ success: true, assignment: updated[0] });
  } catch (error) {
    console.error("Assignment error:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}