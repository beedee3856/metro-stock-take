import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakeLocations, stockTakes, locations, departments, stores } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A stock taker only sees locations assigned to them.
    // If admin or supervisor, they can see all active tasks or filter
    const conditions = [ne(stockTakes.status, "CANCELLED")];
    if (user.role === "STOCK_TAKER") {
      conditions.push(eq(stockTakeLocations.assignedUserId, user.id));
    }

    const tasks = await db
      .select({
        id: stockTakeLocations.id,
        stockTakeId: stockTakeLocations.stockTakeId,
        locationId: stockTakeLocations.locationId,
        status: stockTakeLocations.status,
        expectedItemsCount: stockTakeLocations.expectedItemsCount,
        countedItemsCount: stockTakeLocations.countedItemsCount,
        startedAt: stockTakeLocations.startedAt,
        submittedAt: stockTakeLocations.submittedAt,
        notes: stockTakeLocations.notes,
        // Location Info
        locationCode: locations.locationCode,
        locationName: locations.locationName,
        aisle: locations.aisle,
        shelfSection: locations.shelfSection,
        barcode: locations.barcode,
        departmentName: departments.name,
        // Stock Take Info
        stockTakeNumber: stockTakes.stockTakeNumber,
        stockTakeName: stockTakes.name,
        stockTakeStatus: stockTakes.status,
        isBlindCount: stockTakes.isBlindCount,
        isLocked: stockTakes.isLocked,
        storeName: stores.name,
      })
      .from(stockTakeLocations)
      .leftJoin(stockTakes, eq(stockTakeLocations.stockTakeId, stockTakes.id))
      .leftJoin(locations, eq(stockTakeLocations.locationId, locations.id))
      .leftJoin(departments, eq(locations.departmentId, departments.id))
      .leftJoin(stores, eq(stockTakes.storeId, stores.id))
      .where(and(...conditions))
      .orderBy(locations.locationCode);

    const formatted = tasks.map((t) => {
      const expected = t.expectedItemsCount || 0;
      const counted = t.countedItemsCount || 0;
      const remaining = Math.max(0, expected - counted);
      const progress = expected > 0 ? Math.min(100, Math.round((counted / expected) * 100)) : counted > 0 ? 100 : 0;

      return {
        ...t,
        remaining,
        progress,
      };
    });

    return NextResponse.json({ tasks: formatted });
  } catch (error) {
    console.error("My tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch assigned tasks" }, { status: 500 });
  }
}
