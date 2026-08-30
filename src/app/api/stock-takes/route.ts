import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakes, stores, users, stockTakeLocations, locations, items } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch stock takes with store name and summary counts
    const sessions = await db
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
        isLocked: stockTakes.isLocked,
        createdAt: stockTakes.createdAt,
        storeId: stockTakes.storeId,
        storeName: stores.name,
        createdByName: users.fullName,
      })
      .from(stockTakes)
      .leftJoin(stores, eq(stockTakes.storeId, stores.id))
      .leftJoin(users, eq(stockTakes.createdBy, users.id))
      .orderBy(desc(stockTakes.createdAt));

    // For each session, compute location completion stats
    const results = await Promise.all(
      sessions.map(async (st) => {
        const stlRows = await db
          .select({
            status: stockTakeLocations.status,
            expected: stockTakeLocations.expectedItemsCount,
            counted: stockTakeLocations.countedItemsCount,
          })
          .from(stockTakeLocations)
          .where(eq(stockTakeLocations.stockTakeId, st.id));

        const totalLocations = stlRows.length;
        const completedLocations = stlRows.filter((l) => ["SUBMITTED", "APPROVED", "COMPLETED"].includes(l.status)).length;
        const inProgressLocations = stlRows.filter((l) => ["IN_PROGRESS", "STARTED"].includes(l.status)).length;
        const pendingLocations = totalLocations - completedLocations - inProgressLocations;

        const totalExpected = stlRows.reduce((acc, curr) => acc + (curr.expected || 0), 0);
        const totalCounted = stlRows.reduce((acc, curr) => acc + (curr.counted || 0), 0);
        const progressPercentage = totalExpected > 0 ? Math.min(100, Math.round((totalCounted / totalExpected) * 100)) : totalLocations > 0 ? Math.round((completedLocations / totalLocations) * 100) : 0;

        return {
          ...st,
          totalLocations,
          completedLocations,
          inProgressLocations,
          pendingLocations,
          totalExpected,
          totalCounted,
          progressPercentage,
        };
      })
    );

    return NextResponse.json({ stockTakes: results });
  } catch (error) {
    console.error("Stock takes fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch stock takes" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can delete stock take sessions" }, { status: 403 });
    }

    const body = await req.json();
    const { stockTakeId } = body || {};

    if (!stockTakeId) {
      return NextResponse.json({ error: "stockTakeId is required" }, { status: 400 });
    }

    const existing = await db.select().from(stockTakes).where(eq(stockTakes.id, stockTakeId)).limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Stock take not found" }, { status: 404 });
    }

    const deleted = await db.delete(stockTakes).where(eq(stockTakes.id, stockTakeId)).returning({ id: stockTakes.id });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "STOCK_TAKE_DELETE",
      entityType: "STOCK_TAKE",
      entityId: stockTakeId,
      previousValue: { name: existing[0].name, status: existing[0].status },
      newValue: { deleted: true },
      reason: `Deleted stock take session ${existing[0].stockTakeNumber}`,
    });

    return NextResponse.json({ success: true, deletedCount: deleted.length });
  } catch (error) {
    console.error("Stock take delete error:", error);
    return NextResponse.json({ error: "Failed to delete stock take session" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can create stock takes" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      storeId,
      storeName,
      storeCode,
      type = "FULL",
      startDate,
      plannedEndDate,
      notes,
      isBlindCount = false,
      require100Percent = true,
      twoPersonControl = false,
      allowPartialSubmission = false,
      qtyVarianceThreshold = 5,
      valVarianceThreshold = 100,
      pctVarianceThreshold = 10,
      selectedLocationIds = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Stock Take Name is required" }, { status: 400 });
    }

    let resolvedStoreId = storeId || null;
    const trimmedStoreName = typeof storeName === "string" ? storeName.trim() : "";

    if (!resolvedStoreId && trimmedStoreName) {
      const existingStore = await db
        .select()
        .from(stores)
        .where(eq(stores.name, trimmedStoreName))
        .limit(1);

      if (existingStore.length > 0) {
        resolvedStoreId = existingStore[0].id;
      } else {
        const generatedCode = (storeCode || trimmedStoreName).toString().trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20) || `STORE-${Date.now()}`;
        const insertedStore = await db
          .insert(stores)
          .values({
            code: generatedCode.toUpperCase(),
            name: trimmedStoreName,
            address: null,
            phone: null,
            managerName: null,
          })
          .returning({ id: stores.id });

        if (insertedStore[0]) {
          resolvedStoreId = insertedStore[0].id;
        }
      }
    }
    // Generate reference number ST-YYYY-XXXXX
    const year = new Date().getFullYear();
    const countResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(stockTakes);
    const count = (countResult[0]?.count || 0) + 1;
    const stockTakeNumber = `ST-${year}-${String(count).padStart(5, "0")}`;

    const inserted = await db
      .insert(stockTakes)
      .values({
        stockTakeNumber,
        name: name.trim(),
        storeId: resolvedStoreId,
        type,
        status: "PLANNED",
        startDate: startDate ? new Date(startDate) : new Date(),
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        notes: notes?.trim() || null,
        isBlindCount: Boolean(isBlindCount),
        require100Percent: Boolean(require100Percent),
        twoPersonControl: Boolean(twoPersonControl),
        allowPartialSubmission: Boolean(allowPartialSubmission),
        qtyVarianceThreshold: Number(qtyVarianceThreshold) || 5,
        valVarianceThreshold: String(valVarianceThreshold || "100.00"),
        pctVarianceThreshold: String(pctVarianceThreshold || "10.00"),
        createdBy: user.id,
      })
      .returning();

    const newStockTake = inserted[0];

    // If locations were provided or if FULL store, assign locations to this stock take
    let targetLocations: { id: string }[] = [];
    if (Array.isArray(selectedLocationIds) && selectedLocationIds.length > 0) {
      targetLocations = selectedLocationIds.map((id: string) => ({ id }));
    } else if (type === "FULL") {
      targetLocations = await db
        .select({ id: locations.id })
        .from(locations)
        .where(storeId ? eq(locations.storeId, storeId) : undefined);
    }

    if (targetLocations.length > 0) {
      for (const loc of targetLocations) {
        // Count expected active items for this location
        const itemCounts = await db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(items)
          .where(eq(items.defaultLocationId, loc.id));

        const expectedCount = itemCounts[0]?.count || 0;

        await db.insert(stockTakeLocations).values({
          stockTakeId: newStockTake.id,
          locationId: loc.id,
          status: "NOT_ASSIGNED",
          expectedItemsCount: expectedCount,
          countedItemsCount: 0,
        });
      }
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "STOCK_TAKE_CREATE",
      entityType: "STOCK_TAKE",
      entityId: newStockTake.id,
      newValue: {
        stockTakeNumber: newStockTake.stockTakeNumber,
        name: newStockTake.name,
        storeId,
        locationsCount: targetLocations.length,
      },
      reason: "New stock-taking session initialized",
    });

    return NextResponse.json({ success: true, stockTake: newStockTake }, { status: 201 });
  } catch (error) {
    console.error("Stock take creation error:", error);
    return NextResponse.json({ error: "Failed to create stock take" }, { status: 500 });
  }
}
