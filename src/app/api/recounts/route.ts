import { NextResponse } from "next/server";
import { db } from "@/db";
import { recounts, stockCounts, stockTakes, stockTakeLocations, items, locations, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stockTakeId = searchParams.get("stockTakeId");
    const status = searchParams.get("status");

    // First, auto-complete any recounts whose locations have been closed
    const incompleteRecounts = await db
      .select({
        recountId: recounts.id,
        stockTakeLocationId: recounts.stockTakeLocationId,
        itemId: recounts.itemId,
        locationStatus: stockTakeLocations.status,
        systemQty: recounts.systemQty,
      })
      .from(recounts)
      .leftJoin(stockTakeLocations, eq(recounts.stockTakeLocationId, stockTakeLocations.id))
      .where(eq(recounts.status, "IN_PROGRESS"));

    const now = new Date();
    for (const rec of incompleteRecounts) {
      // If location has been submitted/closed and recount is still in progress, auto-mark as COMPLETED
      if (rec.locationStatus && ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "COMPLETED"].includes(rec.locationStatus)) {
        // Get the stock count for this item to capture the actual recount quantity
        const stockCountRows = await db
          .select()
          .from(stockCounts)
          .where(
            and(
              eq(stockCounts.stockTakeLocationId, rec.stockTakeLocationId),
              eq(stockCounts.itemId, rec.itemId)
            )
          )
          .limit(1);

        let recountQty = null;
        let finalQty = null;
        if (stockCountRows.length > 0) {
          recountQty = stockCountRows[0].physicalQuantity;
          finalQty = stockCountRows[0].physicalQuantity;
        }

        await db
          .update(recounts)
          .set({
            status: "COMPLETED",
            recountPhysicalQty: recountQty,
            finalQuantity: finalQty,
            difference: recountQty ? recountQty - rec.systemQty : null,
            updatedAt: now,
          })
          .where(eq(recounts.id, rec.recountId));
      }
    }

    const conditions = [];
    if (stockTakeId) conditions.push(eq(recounts.stockTakeId, stockTakeId));
    if (status && status !== "ALL") conditions.push(eq(recounts.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: recounts.id,
        stockTakeId: recounts.stockTakeId,
        stockTakeLocationId: recounts.stockTakeLocationId,
        itemId: recounts.itemId,
        reason: recounts.reason,
        systemQty: recounts.systemQty,
        originalPhysicalQty: recounts.originalPhysicalQty,
        recountPhysicalQty: recounts.recountPhysicalQty,
        difference: recounts.difference,
        finalQuantity: recounts.finalQuantity,
        status: recounts.status,
        notes: recounts.notes,
        createdAt: recounts.createdAt,
        resolvedAt: recounts.resolvedAt,
        // Item Details
        itemName: items.itemName,
        itemCode: items.itemCode,
        eanCode: items.eanCode,
        costPrice: items.costPrice,
        // Location Details
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        // Users
        requestedByName: users.fullName,
      })
      .from(recounts)
      .leftJoin(items, eq(recounts.itemId, items.id))
      .leftJoin(stockTakeLocations, eq(recounts.stockTakeLocationId, stockTakeLocations.id))
      .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
      .leftJoin(users, eq(recounts.requestedBy, users.id))
      .where(whereClause)
      .orderBy(desc(recounts.createdAt));

    return NextResponse.json({ recounts: rows });
  } catch (error) {
    console.error("Recounts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch recounts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "REQUEST_RECOUNT")) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to request recounts" }, { status: 403 });
    }

    const body = await req.json();
    const { stockTakeId, stockTakeLocationId, itemId, originalStockCountId, reason = "SUPERVISOR_REQUEST", assignedTo, notes } = body;

    if (!stockTakeId || !stockTakeLocationId || !itemId) {
      return NextResponse.json({ error: "Missing required recount parameters" }, { status: 400 });
    }

    // Get item system stock & original count
    const itemRows = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (itemRows.length === 0) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    const item = itemRows[0];

    let origQty = 0;
    if (originalStockCountId) {
      const c = await db.select().from(stockCounts).where(eq(stockCounts.id, originalStockCountId)).limit(1);
      if (c.length > 0) origQty = c[0].physicalQuantity;
    }

    const inserted = await db
      .insert(recounts)
      .values({
        stockTakeId,
        stockTakeLocationId,
        itemId,
        originalStockCountId: originalStockCountId || null,
        requestedBy: user.id,
        assignedTo: assignedTo || null,
        reason,
        systemQty: item.currentSystemStock,
        originalPhysicalQty: origQty,
        status: assignedTo ? "ASSIGNED" : "PENDING",
        notes: notes || null,
      })
      .returning();

    // Mark location as RECOUNT_REQUIRED
    await db
      .update(stockTakeLocations)
      .set({ status: "RECOUNT_REQUIRED", updatedAt: new Date() })
      .where(eq(stockTakeLocations.id, stockTakeLocationId));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "RECOUNT_REQUESTED",
      entityType: "RECOUNT",
      entityId: inserted[0].id,
      newValue: { item: item.itemName, reason, originalPhysicalQty: origQty },
      reason: notes || "Item marked for physical verification recount",
    });

    return NextResponse.json({ success: true, recount: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("Recount create error:", error);
    return NextResponse.json({ error: "Failed to request recount" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recountId, recountPhysicalQty, finalQuantity, notes, resolutionAction = "ACCEPT_RECOUNT" } = body;

    if (!recountId || recountPhysicalQty === undefined) {
      return NextResponse.json({ error: "recountId and recountPhysicalQty are required" }, { status: 400 });
    }

    const recRows = await db.select().from(recounts).where(eq(recounts.id, recountId)).limit(1);
    if (recRows.length === 0) return NextResponse.json({ error: "Recount record not found" }, { status: 404 });
    const rec = recRows[0];

    const rQty = parseInt(String(recountPhysicalQty), 10);
    const finalQty = finalQuantity !== undefined ? parseInt(String(finalQuantity), 10) : rQty;
    const diff = rQty - rec.originalPhysicalQty;

    const now = new Date();

    const updated = await db
      .update(recounts)
      .set({
        recountPhysicalQty: rQty,
        difference: diff,
        finalQuantity: finalQty,
        status: "COMPLETED",
        notes: notes || rec.notes,
        resolvedAt: now,
        resolvedBy: user.id,
        updatedAt: now,
      })
      .where(eq(recounts.id, recountId))
      .returning();

    // Also update or insert the stock_count line with the finalized count
    const item = (await db.select().from(items).where(eq(items.id, rec.itemId)).limit(1))[0];
    const costNum = item ? Number(item.costPrice) || 0 : 0;
    const varianceQty = finalQty - rec.systemQty;
    const varianceVal = (varianceQty * costNum).toFixed(2);
    const variancePct = rec.systemQty > 0 ? ((varianceQty / rec.systemQty) * 100).toFixed(2) : "0.00";

    if (rec.originalStockCountId) {
      await db
        .update(stockCounts)
        .set({
          physicalQuantity: finalQty,
          varianceQuantity: varianceQty,
          varianceValue: varianceVal,
          variancePercentage: variancePct,
          countStatus: "RECOUNTED",
          countRound: 2,
          notes: `Recount resolved: 1st=${rec.originalPhysicalQty}, 2nd=${rQty}, final=${finalQty}`,
          updatedAt: now,
        })
        .where(eq(stockCounts.id, rec.originalStockCountId));
    }

    // Check if other pending recounts remain for this location
    const otherRecounts = await db
      .select()
      .from(recounts)
      .where(
        and(
          eq(recounts.stockTakeLocationId, rec.stockTakeLocationId),
          eq(recounts.status, "PENDING")
        )
      );

    if (otherRecounts.length === 0) {
      await db
        .update(stockTakeLocations)
        .set({ status: "SUBMITTED", updatedAt: now })
        .where(eq(stockTakeLocations.id, rec.stockTakeLocationId));
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "RECOUNT_RESOLVED",
      entityType: "RECOUNT",
      entityId: recountId,
      previousValue: { originalCount: rec.originalPhysicalQty },
      newValue: { recountCount: rQty, finalQuantity: finalQty, diff },
      reason: notes || "Recount verified and completed",
    });

    return NextResponse.json({ success: true, recount: updated[0] });
  } catch (error) {
    console.error("Recount resolve error:", error);
    return NextResponse.json({ error: "Failed to resolve recount" }, { status: 500 });
  }
}
