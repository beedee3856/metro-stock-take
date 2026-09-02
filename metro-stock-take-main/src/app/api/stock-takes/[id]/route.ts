import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stockTakes,
  stores,
  users,
  stockTakeLocations,
  locations,
  stockCounts,
  recounts,
  items,
  departments,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const stRows = await db
      .select({
        id: stockTakes.id,
        stockTakeNumber: stockTakes.stockTakeNumber,
        name: stockTakes.name,
        type: stockTakes.type,
        status: stockTakes.status,
        startDate: stockTakes.startDate,
        plannedEndDate: stockTakes.plannedEndDate,
        notes: stockTakes.notes,
        isBlindCount: stockTakes.isBlindCount,
        require100Percent: stockTakes.require100Percent,
        twoPersonControl: stockTakes.twoPersonControl,
        allowPartialSubmission: stockTakes.allowPartialSubmission,
        qtyVarianceThreshold: stockTakes.qtyVarianceThreshold,
        valVarianceThreshold: stockTakes.valVarianceThreshold,
        pctVarianceThreshold: stockTakes.pctVarianceThreshold,
        isLocked: stockTakes.isLocked,
        lockedAt: stockTakes.lockedAt,
        unlockReason: stockTakes.unlockReason,
        finalizedAt: stockTakes.finalizedAt,
        createdAt: stockTakes.createdAt,
        storeId: stockTakes.storeId,
        storeName: stores.name,
        createdByName: users.fullName,
      })
      .from(stockTakes)
      .leftJoin(stores, eq(stockTakes.storeId, stores.id))
      .leftJoin(users, eq(stockTakes.createdBy, users.id))
      .where(eq(stockTakes.id, id))
      .limit(1);

    if (stRows.length === 0) {
      return NextResponse.json({ error: "Stock Take not found" }, { status: 404 });
    }

    const stockTake = stRows[0];

    // Fetch stock take locations with assigned users
    const stLocations = await db
      .select({
        id: stockTakeLocations.id,
        stockTakeId: stockTakeLocations.stockTakeId,
        locationId: stockTakeLocations.locationId,
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        aisle: locations.aisle,
        shelfSection: locations.shelfSection,
        departmentName: departments.name,
        status: stockTakeLocations.status,
        assignedUserId: stockTakeLocations.assignedUserId,
        assignedUserName: users.fullName,
        assignedUserRole: users.role,
        expectedItemsCount: stockTakeLocations.expectedItemsCount,
        countedItemsCount: stockTakeLocations.countedItemsCount,
        startedAt: stockTakeLocations.startedAt,
        submittedAt: stockTakeLocations.submittedAt,
        approvedAt: stockTakeLocations.approvedAt,
        notes: stockTakeLocations.notes,
      })
      .from(stockTakeLocations)
      .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
      .leftJoin(departments, eq(locations.departmentId, departments.id))
      .leftJoin(users, eq(stockTakeLocations.assignedUserId, users.id))
      .where(eq(stockTakeLocations.stockTakeId, id))
      .orderBy(locations.locationCode);

    // Fetch summary statistics
    const counts = await db
      .select({
        id: stockCounts.id,
        systemQuantity: stockCounts.systemQuantity,
        physicalQuantity: stockCounts.physicalQuantity,
        varianceQuantity: stockCounts.varianceQuantity,
        costPrice: stockCounts.costPrice,
        varianceValue: stockCounts.varianceValue,
        countStatus: stockCounts.countStatus,
      })
      .from(stockCounts)
      .where(eq(stockCounts.stockTakeId, id));

    let totalSystemQty = 0;
    let totalPhysicalQty = 0;
    let totalVarianceQty = 0;
    let totalVarianceVal = 0;
    let positiveVarianceVal = 0;
    let negativeVarianceVal = 0;
    let itemsWithVarianceCount = 0;

    for (const c of counts) {
      totalSystemQty += c.systemQuantity;
      totalPhysicalQty += c.physicalQuantity;
      totalVarianceQty += c.varianceQuantity;
      const vVal = Number(c.varianceValue) || 0;
      totalVarianceVal += vVal;
      if (c.varianceQuantity > 0) positiveVarianceVal += vVal;
      if (c.varianceQuantity < 0) negativeVarianceVal += Math.abs(vVal);
      if (c.varianceQuantity !== 0) itemsWithVarianceCount++;
    }

    // Pending recounts
    const pendingRecounts = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(recounts)
      .where(eq(recounts.stockTakeId, id));

    const totalLocations = stLocations.length;
    const completedLocations = stLocations.filter((l) => ["SUBMITTED", "APPROVED", "COMPLETED"].includes(l.status)).length;
    const totalExpected = stLocations.reduce((acc, curr) => acc + curr.expectedItemsCount, 0);
    const totalCounted = counts.length;
    const overallProgress = totalExpected > 0 ? Math.min(100, Math.round((totalCounted / totalExpected) * 100)) : totalLocations > 0 ? Math.round((completedLocations / totalLocations) * 100) : 0;

    return NextResponse.json({
      stockTake,
      locations: stLocations,
      stats: {
        totalLocations,
        completedLocations,
        inProgressLocations: stLocations.filter((l) => ["IN_PROGRESS", "STARTED"].includes(l.status)).length,
        submittedLocations: stLocations.filter((l) => l.status === "SUBMITTED").length,
        approvedLocations: stLocations.filter((l) => l.status === "APPROVED").length,
        overallProgress,
        totalExpectedItems: totalExpected,
        totalCountedItems: totalCounted,
        totalSystemQty,
        totalPhysicalQty,
        totalVarianceQty,
        totalVarianceVal: totalVarianceVal.toFixed(2),
        positiveVarianceVal: positiveVarianceVal.toFixed(2),
        negativeVarianceVal: negativeVarianceVal.toFixed(2),
        itemsWithVarianceCount,
        pendingRecountsCount: pendingRecounts[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Stock take details fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stock take details" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason, isBlindCount, twoPersonControl } = body;

    const existingRows = await db.select().from(stockTakes).where(eq(stockTakes.id, id)).limit(1);
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Stock Take not found" }, { status: 404 });
    }

    const st = existingRows[0];

    // Handle locked state: only unlock action allowed
    if (st.isLocked && action !== "UNLOCK") {
      return NextResponse.json({ error: "This stock take is locked. Unlock it first to make changes." }, { status: 423 });
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    switch (action) {
      case "START":
      case "OPEN":
        if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        updateFields.status = "IN_PROGRESS";
        break;

      case "PAUSE":
        updateFields.status = "REVIEW";
        break;

      case "RESUME":
        updateFields.status = "IN_PROGRESS";
        break;

      case "LOCK":
        if (!hasPermission(user.role, "FINALIZE_STOCK_TAKE")) {
          return NextResponse.json({ error: "Forbidden: Only administrators can lock stock takes" }, { status: 403 });
        }
        updateFields.isLocked = true;
        updateFields.lockedAt = new Date();
        updateFields.lockedBy = user.id;
        break;

      case "UNLOCK":
        if (!hasPermission(user.role, "UNLOCK_STOCK_TAKE")) {
          return NextResponse.json({ error: "Forbidden: Only administrators can unlock stock takes" }, { status: 403 });
        }
        if (!reason?.trim()) {
          return NextResponse.json({ error: "A valid reason is required to unlock a stock take" }, { status: 400 });
        }
        updateFields.isLocked = false;
        updateFields.unlockReason = reason.trim();
        break;

      case "CANCEL":
        if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        updateFields.status = "CANCELLED";
        break;

      case "UPDATE_CONFIG":
        if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (isBlindCount !== undefined) updateFields.isBlindCount = Boolean(isBlindCount);
        if (twoPersonControl !== undefined) updateFields.twoPersonControl = Boolean(twoPersonControl);
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const updated = await db.update(stockTakes).set(updateFields).where(eq(stockTakes.id, id)).returning();

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: `STOCK_TAKE_${action}`,
      entityType: "STOCK_TAKE",
      entityId: id,
      previousValue: { status: st.status, isLocked: st.isLocked },
      newValue: { status: updated[0].status, isLocked: updated[0].isLocked },
      reason: reason || `Status changed to ${updated[0].status}`,
    });

    return NextResponse.json({ success: true, stockTake: updated[0] });
  } catch (error) {
    console.error("Stock take update error:", error);
    return NextResponse.json({ error: "Failed to update stock take" }, { status: 500 });
  }
}
