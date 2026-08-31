import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  stockTakes,
  stockTakeLocations,
  stockCounts,
  recounts,
  items,
  locations,
  departments,
  stores,
  users,
  auditLogs,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "VIEW_REPORTS")) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to view reports" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get("type") || "SUMMARY";
    const stockTakeId = searchParams.get("stockTakeId");

    // Fallback to active or latest stock take if none specified
    let targetSTId = stockTakeId;
    if (!targetSTId) {
      const latest = await db.select().from(stockTakes).orderBy(desc(stockTakes.createdAt)).limit(1);
      if (latest.length > 0) targetSTId = latest[0].id;
    }

    if (!targetSTId) {
      return NextResponse.json({ error: "No stock take sessions found" }, { status: 404 });
    }

    const stRows = await db
      .select({
        id: stockTakes.id,
        stockTakeNumber: stockTakes.stockTakeNumber,
        name: stockTakes.name,
        status: stockTakes.status,
        type: stockTakes.type,
        startDate: stockTakes.startDate,
        finalizedAt: stockTakes.finalizedAt,
        storeName: stores.name,
        storeCode: stores.code,
      })
      .from(stockTakes)
      .leftJoin(stores, eq(stockTakes.storeId, stores.id))
      .where(eq(stockTakes.id, targetSTId))
      .limit(1);

    const stInfo = stRows[0];

    // 1. SUMMARY REPORT
    if (reportType === "SUMMARY") {
      const counts = await db
        .select({
          systemQuantity: stockCounts.systemQuantity,
          physicalQuantity: stockCounts.physicalQuantity,
          varianceQuantity: stockCounts.varianceQuantity,
          varianceValue: stockCounts.varianceValue,
        })
        .from(stockCounts)
        .where(eq(stockCounts.stockTakeId, targetSTId));

      const locs = await db
        .select()
        .from(stockTakeLocations)
        .where(eq(stockTakeLocations.stockTakeId, targetSTId));

      const totalExpected = locs.reduce((a, b) => a + (b.expectedItemsCount || 0), 0);
      const totalCounted = counts.length;
      const totalSystem = counts.reduce((a, b) => a + b.systemQuantity, 0);
      const totalPhysical = counts.reduce((a, b) => a + b.physicalQuantity, 0);
      const totalVarianceQty = counts.reduce((a, b) => a + b.varianceQuantity, 0);
      const totalVarianceVal = counts.reduce((a, b) => a + (Number(b.varianceValue) || 0), 0);

      const posVarianceVal = counts
        .filter((c) => c.varianceQuantity > 0)
        .reduce((a, b) => a + (Number(b.varianceValue) || 0), 0);
      const negVarianceVal = counts
        .filter((c) => c.varianceQuantity < 0)
        .reduce((a, b) => a + Math.abs(Number(b.varianceValue) || 0), 0);

      return NextResponse.json({
        reportType: "SUMMARY",
        stockTake: stInfo,
        data: {
          totalLocations: locs.length,
          completedLocations: locs.filter((l) => ["SUBMITTED", "APPROVED", "COMPLETED"].includes(l.status)).length,
          totalExpected,
          totalCounted,
          totalNotCounted: Math.max(0, totalExpected - totalCounted),
          totalSystem,
          totalPhysical,
          totalVarianceQty,
          totalVarianceVal: totalVarianceVal.toFixed(2),
          positiveVarianceVal: posVarianceVal.toFixed(2),
          negativeVarianceVal: negVarianceVal.toFixed(2),
        },
      });
    }

    // 2. DETAILED COUNTS REPORT
    if (reportType === "DETAILED") {
      const detailed = await db
        .select({
          id: stockCounts.id,
          date: stockCounts.createdAt,
          locationCode: locations.locationCode,
          locationName: locations.locationName,
          departmentName: departments.name,
          itemName: items.itemName,
          itemCode: items.itemCode,
          eanCode: items.eanCode,
          systemQuantity: stockCounts.systemQuantity,
          physicalQuantity: stockCounts.physicalQuantity,
          varianceQuantity: stockCounts.varianceQuantity,
          costPrice: stockCounts.costPrice,
          varianceValue: stockCounts.varianceValue,
          stockTaker: users.fullName,
          status: stockCounts.countStatus,
        })
        .from(stockCounts)
        .leftJoin(items, eq(stockCounts.itemId, items.id))
        .leftJoin(stockTakeLocations, eq(stockCounts.stockTakeLocationId, stockTakeLocations.id))
        .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
        .leftJoin(departments, eq(locations.departmentId, departments.id))
        .leftJoin(users, eq(stockCounts.userId, users.id))
        .where(eq(stockCounts.stockTakeId, targetSTId))
        .orderBy(locations.locationCode, items.itemName);

      return NextResponse.json({
        reportType: "DETAILED",
        stockTake: stInfo,
        rows: detailed,
      });
    }

    // 3. VARIANCE REPORT
    if (reportType === "VARIANCE") {
      const variances = await db
        .select({
          id: stockCounts.id,
          itemName: items.itemName,
          itemCode: items.itemCode,
          eanCode: items.eanCode,
          locationCode: locations.locationCode,
          departmentName: departments.name,
          systemStock: stockCounts.systemQuantity,
          physicalStock: stockCounts.physicalQuantity,
          varianceQty: stockCounts.varianceQuantity,
          costPrice: stockCounts.costPrice,
          varianceValue: stockCounts.varianceValue,
          variancePercentage: stockCounts.variancePercentage,
          status: stockCounts.countStatus,
          countedBy: users.fullName,
        })
        .from(stockCounts)
        .leftJoin(items, eq(stockCounts.itemId, items.id))
        .leftJoin(stockTakeLocations, eq(stockCounts.stockTakeLocationId, stockTakeLocations.id))
        .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
        .leftJoin(departments, eq(locations.departmentId, departments.id))
        .leftJoin(users, eq(stockCounts.userId, users.id))
        .where(and(eq(stockCounts.stockTakeId, targetSTId), sql`${stockCounts.varianceQuantity} != 0`))
        .orderBy(desc(sql`abs(${stockCounts.varianceValue})`));

      // Group by item and calculate totals
      const itemVarianceMap = new Map<
        string,
        {
          itemName: string;
          itemCode: string;
          eanCode: string;
          costPrice: string;
          totalCounts: number;
          totalSystemStock: number;
          totalPhysicalStock: number;
          totalVarianceQty: number;
          totalVarianceValue: number;
          varianceRecords: typeof variances;
        }
      >();

      for (const v of variances) {
        const key = String(v.itemCode);
        if (itemVarianceMap.has(key)) {
          const existing = itemVarianceMap.get(key)!;
          existing.totalCounts += 1;
          existing.totalSystemStock += Number(v.systemStock || 0);
          existing.totalPhysicalStock += Number(v.physicalStock || 0);
          existing.totalVarianceQty += Number(v.varianceQty);
          existing.totalVarianceValue += Number(v.varianceValue || 0);
          existing.varianceRecords.push(v);
        } else {
          itemVarianceMap.set(key, {
            itemName: String(v.itemName),
            itemCode: String(v.itemCode),
            eanCode: String(v.eanCode),
            costPrice: String(v.costPrice),
            totalCounts: 1,
            totalSystemStock: Number(v.systemStock || 0),
            totalPhysicalStock: Number(v.physicalStock || 0),
            totalVarianceQty: Number(v.varianceQty),
            totalVarianceValue: Number(v.varianceValue || 0),
            varianceRecords: [v],
          });
        }
      }

      // Convert map to array with aggregated data
      const aggregatedVariances = Array.from(itemVarianceMap.values()).map((item) => ({
        itemName: item.itemName,
        itemCode: item.itemCode,
        eanCode: item.eanCode,
        costPrice: item.costPrice,
        totalCountRecords: item.totalCounts,
        locationsCount: item.totalCounts,
        totalSystemStock: item.totalSystemStock,
        totalPhysicalStock: item.totalPhysicalStock,
        totalCountedUnits: item.totalPhysicalStock,
        totalVarianceQty: item.totalVarianceQty,
        totalVarianceValue: item.totalVarianceValue.toFixed(2),
      }));

      return NextResponse.json({
        reportType: "VARIANCE",
        stockTake: stInfo,
        rows: aggregatedVariances,
      });
    }

    // 4. LOCATION REPORT
    if (reportType === "LOCATIONS") {
      const locReport = await db
        .select({
          id: stockTakeLocations.id,
          locationCode: locations.locationCode,
          locationName: locations.locationName,
          departmentName: departments.name,
          assignedStockTaker: users.fullName,
          expectedItems: stockTakeLocations.expectedItemsCount,
          countedItems: stockTakeLocations.countedItemsCount,
          status: stockTakeLocations.status,
          startedAt: stockTakeLocations.startedAt,
          submittedAt: stockTakeLocations.submittedAt,
        })
        .from(stockTakeLocations)
        .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
        .leftJoin(departments, eq(locations.departmentId, departments.id))
        .leftJoin(users, eq(stockTakeLocations.assignedUserId, users.id))
        .where(eq(stockTakeLocations.stockTakeId, targetSTId))
        .orderBy(locations.locationCode);

      const formatted = locReport.map((l) => ({
        ...l,
        remaining: Math.max(0, l.expectedItems - l.countedItems),
        progress: l.expectedItems > 0 ? Math.min(100, Math.round((l.countedItems / l.expectedItems) * 100)) : 0,
      }));

      return NextResponse.json({
        reportType: "LOCATIONS",
        stockTake: stInfo,
        rows: formatted,
      });
    }

    // 5. STAFF PERFORMANCE REPORT
    if (reportType === "PERFORMANCE") {
      const takers = await db
        .select({
          userId: users.id,
          fullName: users.fullName,
          username: users.username,
        })
        .from(users)
        .where(eq(users.role, "STOCK_TAKER"));

      const perfData = await Promise.all(
        takers.map(async (t) => {
          const locs = await db
            .select()
            .from(stockTakeLocations)
            .where(
              and(
                eq(stockTakeLocations.stockTakeId, targetSTId),
                eq(stockTakeLocations.assignedUserId, t.userId)
              )
            );

          const counts = await db
            .select()
            .from(stockCounts)
            .where(and(eq(stockCounts.stockTakeId, targetSTId), eq(stockCounts.userId, t.userId)));

          const recs = await db
            .select()
            .from(recounts)
            .where(and(eq(recounts.stockTakeId, targetSTId), eq(recounts.assignedTo, t.userId)));

          const completedLocs = locs.filter((l) => ["SUBMITTED", "APPROVED", "COMPLETED"].includes(l.status)).length;
          const exactCounts = counts.filter((c) => c.varianceQuantity === 0).length;
          const accuracyPct = counts.length > 0 ? Math.round((exactCounts / counts.length) * 100) : 100;

          return {
            stockTaker: t.fullName,
            locationsAssigned: locs.length,
            locationsCompleted: completedLocs,
            itemsCounted: counts.length,
            recountsAssigned: recs.length,
            accuracyPercentage: accuracyPct,
          };
        })
      );

      return NextResponse.json({
        reportType: "PERFORMANCE",
        stockTake: stInfo,
        rows: perfData,
      });
    }

    // 6. RECOUNT REPORT
    if (reportType === "RECOUNTS") {
      const recReport = await db
        .select({
          id: recounts.id,
          itemName: items.itemName,
          itemCode: items.itemCode,
          eanCode: items.eanCode,
          locationCode: locations.locationCode,
          systemStock: recounts.systemQty,
          firstCount: recounts.originalPhysicalQty,
          secondCount: recounts.recountPhysicalQty,
          difference: recounts.difference,
          finalQuantity: recounts.finalQuantity,
          reason: recounts.reason,
          status: recounts.status,
          requestedBy: users.fullName,
          createdAt: recounts.createdAt,
          resolvedAt: recounts.resolvedAt,
        })
        .from(recounts)
        .leftJoin(items, eq(recounts.itemId, items.id))
        .leftJoin(stockTakeLocations, eq(recounts.stockTakeLocationId, stockTakeLocations.id))
        .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
        .leftJoin(users, eq(recounts.requestedBy, users.id))
        .where(eq(recounts.stockTakeId, targetSTId))
        .orderBy(desc(recounts.createdAt));

      return NextResponse.json({
        reportType: "RECOUNTS",
        stockTake: stInfo,
        rows: recReport,
      });
    }

    // 7. AUDIT REPORT
    if (reportType === "AUDIT") {
      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(100);

      return NextResponse.json({
        reportType: "AUDIT",
        stockTake: stInfo,
        rows: logs,
      });
    }

    return NextResponse.json({ error: "Invalid report type requested" }, { status: 400 });
  } catch (error) {
    console.error("Report data error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
