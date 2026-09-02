import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakeLocations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_STOCK_TAKES")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can delete stock take locations" }, { status: 403 });
    }

    const { id: stockTakeId } = await params;

    // Count how many locations will be deleted
    const existingCount = await db
      .select()
      .from(stockTakeLocations)
      .where(eq(stockTakeLocations.stockTakeId, stockTakeId));

    if (existingCount.length === 0) {
      return NextResponse.json({ error: "No locations found for this stock take" }, { status: 404 });
    }

    const deletedCount = existingCount.length;

    // Delete all stock take locations for this stock take
    const deleted = await db
      .delete(stockTakeLocations)
      .where(eq(stockTakeLocations.stockTakeId, stockTakeId))
      .returning({ id: stockTakeLocations.id });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "DELETE_ALL_STOCK_TAKE_LOCATIONS",
      entityType: "STOCK_TAKE",
      entityId: stockTakeId,
      newValue: { deletedCount },
      reason: `Deleted all ${deletedCount} locations from stock take`,
    });

    return NextResponse.json({ success: true, deletedCount: deleted.length });
  } catch (error) {
    console.error("Delete stock take locations error:", error);
    return NextResponse.json({ error: "Failed to delete locations" }, { status: 500 });
  }
}
