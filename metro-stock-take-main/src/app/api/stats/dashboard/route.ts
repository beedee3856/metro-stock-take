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
  users,
} from "@/db/schema";
import { eq, and, sql, desc, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Stock takes counts by status
    const allST = await db.select().from(stockTakes).orderBy(desc(stockTakes.createdAt));
    const activeStockTakes = allST.filter((st) => ["OPEN", "IN_PROGRESS", "COUNTING", "REVIEW", "RECOUNT"].includes(st.status));
    const plannedStockTakes = allST.filter((st) => ["PLANNED", "DRAFT"].includes(st.status));
    const completedStockTakes = allST.filter((st) => ["APPROVED", "FINALIZED"].includes(st.status));

    // Active stock take focus (default to first active or latest)
    const currentST = activeStockTakes[0] || allST[0];

    // 2. Master entities counts
    const totalItemsResult = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(items);
    const totalLocationsResult = await db.select({ count: sql<number>`cast(count(*) as integer)` }).from(locations);
    const totalStockTakersResult = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(users)
      .where(eq(users.role, "STOCK_TAKER"));

    const totalItems = totalItemsResult[0]?.count || 0;
    const totalLocations = totalLocationsResult[0]?.count || 0;
    const assignedStockTakers = totalStockTakersResult[0]?.count || 0;

    // 3. For current/active session metrics
    let itemsCounted = 0;
    let itemsExpected = 0;
    let itemsPending = 0;
    let totalVarianceVal = 0;
    let posVarianceVal = 0;
    let negVarianceVal = 0;
    let pendingRecounts = 0;
    let locationCompletionPct = 0;
    let completedLocs = 0;
    let pendingLocs = 0;
    let inProgressLocs = 0;

    // Breakdown datasets for charts
    let varianceByDept: { department: string; varianceVal: number; itemsCount: number }[] = [];
    let varianceByLocation: { location: string; varianceVal: number; varianceQty: number }[] = [];
    let takerProductivity: { name: string; counted: number; accuracy: number }[] = [];

    if (currentST) {
      const stLocations = await db
        .select({
          id: stockTakeLocations.id,
          status: stockTakeLocations.status,
          expected: stockTakeLocations.expectedItemsCount,
          counted: stockTakeLocations.countedItemsCount,
          locationCode: locations.locationCode,
          locationName: locations.locationName,
          deptName: departments.name,
        })
        .from(stockTakeLocations)
        .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
        .leftJoin(departments, eq(locations.departmentId, departments.id))
        .where(eq(stockTakeLocations.stockTakeId, currentST.id));

      completedLocs = stLocations.filter((l) => ["SUBMITTED", "APPROVED", "COMPLETED"].includes(l.status)).length;
      inProgressLocs = stLocations.filter((l) => ["IN_PROGRESS", "STARTED"].includes(l.status)).length;
      pendingLocs = stLocations.length - completedLocs - inProgressLocs;
      locationCompletionPct = stLocations.length > 0 ? Math.round((completedLocs / stLocations.length) * 100) : 0;

      itemsExpected = stLocations.reduce((a, b) => a + (b.expected || 0), 0);

      // Counts in this session
      const counts = await db
        .select({
          id: stockCounts.id,
          varianceQuantity: stockCounts.varianceQuantity,
          varianceValue: stockCounts.varianceValue,
          costPrice: stockCounts.costPrice,
          userId: stockCounts.userId,
          departmentName: departments.name,
          locationCode: locations.locationCode,
        })
        .from(stockCounts)
        .leftJoin(items, eq(stockCounts.itemId, items.id))
        .leftJoin(departments, eq(items.departmentId, departments.id))
        .leftJoin(stockTakeLocations, eq(stockCounts.stockTakeLocationId, stockTakeLocations.id))
        .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
        .where(eq(stockCounts.stockTakeId, currentST.id));

      itemsCounted = counts.length;
      itemsPending = Math.max(0, itemsExpected - itemsCounted);

      for (const c of counts) {
        const val = Number(c.varianceValue) || 0;
        totalVarianceVal += val;
        if (c.varianceQuantity > 0) posVarianceVal += val;
        if (c.varianceQuantity < 0) negVarianceVal += Math.abs(val);
      }

      // Recounts in this session
      const recs = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(recounts)
        .where(and(eq(recounts.stockTakeId, currentST.id), eq(recounts.status, "PENDING")));
      pendingRecounts = recs[0]?.count || 0;

      // Group variance by department
      const deptMap = new Map<string, { val: number; count: number }>();
      counts.forEach((c) => {
        const dept = c.departmentName || "Other";
        const prev = deptMap.get(dept) || { val: 0, count: 0 };
        deptMap.set(dept, {
          val: prev.val + (Number(c.varianceValue) || 0),
          count: prev.count + 1,
        });
      });
      varianceByDept = Array.from(deptMap.entries()).map(([dept, d]) => ({
        department: dept,
        varianceVal: Number(d.val.toFixed(2)),
        itemsCount: d.count,
      }));

      // Group variance by location
      const locMap = new Map<string, { val: number; qty: number }>();
      counts.forEach((c) => {
        const loc = c.locationCode || "Unknown";
        const prev = locMap.get(loc) || { val: 0, qty: 0 };
        locMap.set(loc, {
          val: prev.val + (Number(c.varianceValue) || 0),
          qty: prev.qty + c.varianceQuantity,
        });
      });
      varianceByLocation = Array.from(locMap.entries()).map(([loc, d]) => ({
        location: loc,
        varianceVal: Number(d.val.toFixed(2)),
        varianceQty: d.qty,
      }));

      // Stock taker productivity
      const allTakers = await db.select().from(users).where(eq(users.role, "STOCK_TAKER"));
      takerProductivity = allTakers.map((t) => {
        const tCounts = counts.filter((c) => c.userId === t.id);
        const exact = tCounts.filter((c) => c.varianceQuantity === 0).length;
        const accuracy = tCounts.length > 0 ? Math.round((exact / tCounts.length) * 100) : 100;
        return {
          name: t.fullName,
          counted: tCounts.length,
          accuracy,
        };
      });
    }

    const overallProgress = itemsExpected > 0 ? Math.min(100, Math.round((itemsCounted / itemsExpected) * 100)) : 0;

    // Review queue: locations submitted by stock takers, awaiting supervisor action
    const queueRows = await db
      .select({
        id: stockTakeLocations.id,
        stockTakeId: stockTakeLocations.stockTakeId,
        stockTakeNumber: stockTakes.stockTakeNumber,
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        takerName: users.fullName,
        submittedAt: stockTakeLocations.submittedAt,
        expected: stockTakeLocations.expectedItemsCount,
        counted: stockTakeLocations.countedItemsCount,
      })
      .from(stockTakeLocations)
      .leftJoin(stockTakes, eq(stockTakeLocations.stockTakeId, stockTakes.id))
      .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
      .leftJoin(users, eq(stockTakeLocations.assignedUserId, users.id))
      .where(eq(stockTakeLocations.status, "SUBMITTED"))
      .orderBy(desc(stockTakeLocations.submittedAt));

    const reviewQueue = await Promise.all(
      queueRows.map(async (r) => {
        const agg = await db
          .select({
            netQty: sql<number>`coalesce(sum(${stockCounts.varianceQuantity}), 0)`,
            netVal: sql<number>`coalesce(sum(cast(${stockCounts.varianceValue} as numeric)), 0)`,
            negativeLines: sql<number>`coalesce(sum(case when ${stockCounts.varianceQuantity} < 0 then 1 else 0 end), 0)`,
          })
          .from(stockCounts)
          .where(eq(stockCounts.stockTakeLocationId, r.id));
        const a = agg[0];
        return {
          ...r,
          netVarianceQty: Number(a?.netQty ?? 0),
          netVarianceVal: Number(a?.netVal ?? 0),
          negativeLines: Number(a?.negativeLines ?? 0),
        };
      })
    );

    return NextResponse.json({
      reviewQueue,
      summary: {
        activeStockTakes: activeStockTakes.length,
        plannedStockTakes: plannedStockTakes.length,
        completedStockTakes: completedStockTakes.length,
        locations: totalLocations,
        totalItems,
        assignedStockTakers,
        itemsCounted,
        itemsExpected,
        itemsPending,
        totalVarianceVal: totalVarianceVal.toFixed(2),
        positiveVarianceVal: posVarianceVal.toFixed(2),
        negativeVarianceVal: negVarianceVal.toFixed(2),
        pendingRecounts,
      },
      currentStockTake: currentST
        ? {
            id: currentST.id,
            number: currentST.stockTakeNumber,
            name: currentST.name,
            status: currentST.status,
            type: currentST.type,
            isBlindCount: currentST.isBlindCount,
          }
        : null,
      progress: {
        overallProgress,
        locationCompletionPct,
        completedLocations: completedLocs,
        pendingLocations: pendingLocs,
        inProgressLocations: inProgressLocs,
        itemsCounted,
        itemsExpected,
      },
      charts: {
        varianceByDept,
        varianceByLocation,
        takerProductivity,
        varianceSplit: [
          { name: "Positive Variance (+)", value: Number(posVarianceVal.toFixed(2)), color: "#10b981" },
          { name: "Negative Variance (-)", value: Number(negVarianceVal.toFixed(2)), color: "#ef4444" },
        ],
        locationsSplit: [
          { name: "Completed", value: completedLocs, color: "#10b981" },
          { name: "In Progress", value: inProgressLocs, color: "#f59e0b" },
          { name: "Pending", value: pendingLocs, color: "#94a3b8" },
        ],
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to load dashboard metrics" }, { status: 500 });
  }
}
