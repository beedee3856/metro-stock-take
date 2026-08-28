import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stockCounts,
  stockTakes,
  stockTakeLocations,
  items,
  users,
  locations,
  recounts,
} from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stockTakeId = searchParams.get("stockTakeId");
    const stockTakeLocationId = searchParams.get("stockTakeLocationId");
    const itemId = searchParams.get("itemId");
    const varianceType = searchParams.get("varianceType") || "ALL";

    const conditions = [];

    if (stockTakeId) {
      conditions.push(eq(stockCounts.stockTakeId, stockTakeId));
    }
    if (stockTakeLocationId) {
      conditions.push(eq(stockCounts.stockTakeLocationId, stockTakeLocationId));
    }
    if (itemId) {
      conditions.push(eq(stockCounts.itemId, itemId));
    }

    if (varianceType === "POSITIVE") {
      conditions.push(sql`${stockCounts.varianceQuantity} > 0`);
    } else if (varianceType === "NEGATIVE") {
      conditions.push(sql`${stockCounts.varianceQuantity} < 0`);
    } else if (varianceType === "ZERO") {
      conditions.push(sql`${stockCounts.varianceQuantity} = 0`);
    } else if (varianceType === "NON_ZERO") {
      conditions.push(sql`${stockCounts.varianceQuantity} != 0`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: stockCounts.id,
        stockTakeId: stockCounts.stockTakeId,
        stockTakeLocationId: stockCounts.stockTakeLocationId,
        itemId: stockCounts.itemId,
        systemQuantity: stockCounts.systemQuantity,
        physicalQuantity: stockCounts.physicalQuantity,
        verificationQuantity: stockCounts.verificationQuantity,
        varianceQuantity: stockCounts.varianceQuantity,
        costPrice: stockCounts.costPrice,
        varianceValue: stockCounts.varianceValue,
        variancePercentage: stockCounts.variancePercentage,
        countRound: stockCounts.countRound,
        countStatus: stockCounts.countStatus,
        notes: stockCounts.notes,
        createdAt: stockCounts.createdAt,
        updatedAt: stockCounts.updatedAt,
        // Item Details
        itemName: items.itemName,
        itemCode: items.itemCode,
        eanCode: items.eanCode,
        brand: items.brand,
        uom: items.uom,
        packSize: items.packSize,
        // Location Details
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        // User Details
        countedBy: users.fullName,
        countedByUsername: users.username,
      })
      .from(stockCounts)
      .leftJoin(items, eq(stockCounts.itemId, items.id))
      .leftJoin(stockTakeLocations, eq(stockCounts.stockTakeLocationId, stockTakeLocations.id))
      .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
      .leftJoin(users, eq(stockCounts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(stockCounts.createdAt));

    // If current session has blind counting enabled and user is STOCK_TAKER, mask systemQuantity and variance
    let isBlind = false;
    if (stockTakeId && user.role === "STOCK_TAKER") {
      const st = await db.select({ isBlindCount: stockTakes.isBlindCount }).from(stockTakes).where(eq(stockTakes.id, stockTakeId)).limit(1);
      if (st.length > 0 && st[0].isBlindCount) {
        isBlind = true;
      }
    }

    const sanitizedRows = rows.map((r) => {
      if (isBlind) {
        return {
          ...r,
          systemQuantity: null,
          varianceQuantity: null,
          varianceValue: null,
          variancePercentage: null,
        };
      }
      return r;
    });

    return NextResponse.json({ counts: sanitizedRows });
  } catch (error) {
    console.error("Stock counts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stock counts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      stockTakeId,
      stockTakeLocationId,
      itemId,
      physicalQuantity,
      duplicateAction = "ERROR_IF_EXISTS", // ERROR_IF_EXISTS, EDIT_EXISTING, ADD_ADDITIONAL
      notes,
      clientUuid,
    } = body;

    if (!stockTakeId || !stockTakeLocationId || !itemId || physicalQuantity === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const qty = parseInt(String(physicalQuantity), 10);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: "Physical quantity must be a non-negative integer" }, { status: 400 });
    }

    // Verify stock take session
    const stRows = await db.select().from(stockTakes).where(eq(stockTakes.id, stockTakeId)).limit(1);
    if (stRows.length === 0) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }
    const st = stRows[0];

    if (st.isLocked || st.status === "FINALIZED" || st.status === "CANCELLED") {
      return NextResponse.json({ error: "This stock take is locked or finalized. Counts cannot be modified." }, { status: 423 });
    }

    // Verify location assignment
    const stlRows = await db
      .select()
      .from(stockTakeLocations)
      .where(and(eq(stockTakeLocations.id, stockTakeLocationId), eq(stockTakeLocations.stockTakeId, stockTakeId)))
      .limit(1);
    if (stlRows.length === 0) {
      return NextResponse.json({ error: "Stock take location not found" }, { status: 404 });
    }
    const stl = stlRows[0];

    // Authorization check: stock takers can ONLY count assigned locations
    if (user.role === "STOCK_TAKER" && stl.assignedUserId !== user.id) {
      return NextResponse.json({ error: "You are not authorized to count this location." }, { status: 403 });
    }

    // Get item info
    const itemRows = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (itemRows.length === 0) {
      return NextResponse.json({ error: "Item not found in master" }, { status: 404 });
    }
    const item = itemRows[0];

    // Check duplicate count in this location
    const existingCounts = await db
      .select()
      .from(stockCounts)
      .where(
        and(
          eq(stockCounts.stockTakeLocationId, stockTakeLocationId),
          eq(stockCounts.itemId, itemId)
        )
      )
      .limit(1);

    if (existingCounts.length > 0) {
      const existing = existingCounts[0];

      if (duplicateAction === "ERROR_IF_EXISTS") {
        return NextResponse.json(
          {
            isDuplicate: true,
            error: "This item has already been counted in this location.",
            existingCount: {
              id: existing.id,
              physicalQuantity: existing.physicalQuantity,
              createdAt: existing.createdAt,
            },
          },
          { status: 409 }
        );
      }

      // Handle duplicate action
      let newPhysicalQty = qty;
      if (duplicateAction === "ADD_ADDITIONAL") {
        newPhysicalQty = existing.physicalQuantity + qty;
      }

      const systemQty = existing.systemQuantity;
      const varianceQty = newPhysicalQty - systemQty;
      const costNum = Number(item.costPrice) || 0;
      const varianceVal = (varianceQty * costNum).toFixed(2);
      const variancePct = systemQty > 0 ? ((varianceQty / systemQty) * 100).toFixed(2) : "0.00";

      // Check thresholds
      let countStatus = "COUNTED";
      const qtyThreshold = st.qtyVarianceThreshold || 5;
      const valThreshold = Number(st.valVarianceThreshold) || 100;
      const pctThreshold = Number(st.pctVarianceThreshold) || 10;

      if (
        Math.abs(varianceQty) >= qtyThreshold ||
        Math.abs(Number(varianceVal)) >= valThreshold ||
        Math.abs(Number(variancePct)) >= pctThreshold
      ) {
        countStatus = "RECOUNT_REQUIRED";
      }

      const updated = await db
        .update(stockCounts)
        .set({
          physicalQuantity: newPhysicalQty,
          varianceQuantity: varianceQty,
          varianceValue: varianceVal,
          variancePercentage: variancePct,
          countStatus,
          notes: notes || existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(stockCounts.id, existing.id))
        .returning();

      await logAudit({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: "COUNT_EDIT",
        entityType: "STOCK_COUNT",
        entityId: existing.id,
        previousValue: { physicalQuantity: existing.physicalQuantity },
        newValue: { physicalQuantity: newPhysicalQty, action: duplicateAction },
        reason: notes || `Count edited via ${duplicateAction}`,
      });

      return NextResponse.json({ success: true, count: updated[0] });
    }

    // New count calculation
    const systemQty = item.currentSystemStock;
    const varianceQty = qty - systemQty;
    const costNum = Number(item.costPrice) || 0;
    const varianceVal = (varianceQty * costNum).toFixed(2);
    const variancePct = systemQty > 0 ? ((varianceQty / systemQty) * 100).toFixed(2) : "0.00";

    // Threshold evaluation
    let countStatus = "COUNTED";
    const qtyThreshold = st.qtyVarianceThreshold || 5;
    const valThreshold = Number(st.valVarianceThreshold) || 100;
    const pctThreshold = Number(st.pctVarianceThreshold) || 10;

    const exceedsThreshold =
      Math.abs(varianceQty) >= qtyThreshold ||
      Math.abs(Number(varianceVal)) >= valThreshold ||
      Math.abs(Number(variancePct)) >= pctThreshold;

    if (exceedsThreshold && varianceQty !== 0) {
      countStatus = "RECOUNT_REQUIRED";
    }

    const inserted = await db
      .insert(stockCounts)
      .values({
        clientUuid: clientUuid || null,
        stockTakeId,
        stockTakeLocationId,
        itemId,
        userId: user.id,
        systemQuantity: systemQty,
        physicalQuantity: qty,
        varianceQuantity: varianceQty,
        costPrice: item.costPrice,
        varianceValue: varianceVal,
        variancePercentage: variancePct,
        countStatus,
        notes: notes || null,
      })
      .returning();

    const newCount = inserted[0];

    // Update location stats: increment counted items and set status to IN_PROGRESS if STARTED/ASSIGNED
    const newCountedItems = (stl.countedItemsCount || 0) + 1;
    const newLocStatus = ["NOT_ASSIGNED", "ASSIGNED"].includes(stl.status) ? "IN_PROGRESS" : stl.status;

    await db
      .update(stockTakeLocations)
      .set({
        countedItemsCount: newCountedItems,
        status: newLocStatus,
        startedAt: stl.startedAt || new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stockTakeLocations.id, stockTakeLocationId));

    // If high variance auto-flagged, create recount record
    if (countStatus === "RECOUNT_REQUIRED") {
      await db.insert(recounts).values({
        stockTakeId,
        stockTakeLocationId,
        itemId,
        originalStockCountId: newCount.id,
        requestedBy: user.id,
        reason: Math.abs(Number(varianceVal)) >= valThreshold ? "HIGH_VALUE" : "LARGE_VARIANCE",
        systemQty,
        originalPhysicalQty: qty,
        status: "PENDING",
        notes: `Variance exceeds threshold (Variance: ${varianceQty}, Value: ${varianceVal})`,
      });
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "COUNT_ENTRY",
      entityType: "STOCK_COUNT",
      entityId: newCount.id,
      newValue: {
        item: item.itemName,
        systemQuantity: systemQty,
        physicalQuantity: qty,
        variance: varianceQty,
      },
    });

    return NextResponse.json({ success: true, count: newCount }, { status: 201 });
  } catch (error) {
    console.error("Count entry error:", error);
    return NextResponse.json({ error: "Failed to record stock count" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { countId, physicalQuantity, reason } = body;

    if (!countId || physicalQuantity === undefined) {
      return NextResponse.json({ error: "countId and physicalQuantity are required" }, { status: 400 });
    }

    const qty = parseInt(String(physicalQuantity), 10);
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const countRows = await db.select().from(stockCounts).where(eq(stockCounts.id, countId)).limit(1);
    if (countRows.length === 0) {
      return NextResponse.json({ error: "Stock count not found" }, { status: 404 });
    }
    const count = countRows[0];

    const costNum = Number(count.costPrice) || 0;
    const varianceQty = qty - count.systemQuantity;
    const varianceVal = (varianceQty * costNum).toFixed(2);
    const variancePct = count.systemQuantity > 0 ? ((varianceQty / count.systemQuantity) * 100).toFixed(2) : "0.00";

    const updated = await db
      .update(stockCounts)
      .set({
        physicalQuantity: qty,
        varianceQuantity: varianceQty,
        varianceValue: varianceVal,
        variancePercentage: variancePct,
        notes: reason || count.notes,
        updatedAt: new Date(),
      })
      .where(eq(stockCounts.id, countId))
      .returning();

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "COUNT_EDIT",
      entityType: "STOCK_COUNT",
      entityId: countId,
      previousValue: { physicalQuantity: count.physicalQuantity },
      newValue: { physicalQuantity: qty },
      reason: reason || "Manual count edit",
    });

    return NextResponse.json({ success: true, count: updated[0] });
  } catch (error) {
    console.error("Count edit error:", error);
    return NextResponse.json({ error: "Failed to edit count" }, { status: 500 });
  }
}
