import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakeLocations, stockCounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "APPROVE_COUNTS")) {
      return NextResponse.json({ error: "Forbidden: Only supervisors and administrators can approve counts" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action = "APPROVE", rejectionReason } = body;

    const stlRows = await db.select().from(stockTakeLocations).where(eq(stockTakeLocations.id, id)).limit(1);
    if (stlRows.length === 0) {
      return NextResponse.json({ error: "Location record not found" }, { status: 404 });
    }
    const stl = stlRows[0];

    // Prevent stock takers from approving their own counts
    if (stl.assignedUserId === user.id && user.role === "STOCK_TAKER") {
      return NextResponse.json({ error: "Forbidden: You cannot approve your own stock count." }, { status: 403 });
    }

    const now = new Date();

    if (action === "REJECT") {
      const updated = await db
        .update(stockTakeLocations)
        .set({
          status: "IN_PROGRESS",
          notes: rejectionReason ? `Rejected: ${rejectionReason}` : "Count rejected by supervisor. Please recount.",
          updatedAt: now,
        })
        .where(eq(stockTakeLocations.id, id))
        .returning();

      await logAudit({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: "LOCATION_COUNT_REJECTED",
        entityType: "STOCK_TAKE_LOCATION",
        entityId: id,
        reason: rejectionReason || "Supervisor rejected submitted counts",
      });

      return NextResponse.json({ success: true, status: "REJECTED", location: updated[0] });
    }

    // Approve
    const updated = await db
      .update(stockTakeLocations)
      .set({
        status: "APPROVED",
        approvedAt: now,
        approvedBy: user.id,
        updatedAt: now,
      })
      .where(eq(stockTakeLocations.id, id))
      .returning();

    // Mark count lines in this location as APPROVED
    await db
      .update(stockCounts)
      .set({ countStatus: "APPROVED", updatedAt: now })
      .where(eq(stockCounts.stockTakeLocationId, id));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "LOCATION_COUNT_APPROVED",
      entityType: "STOCK_TAKE_LOCATION",
      entityId: id,
      newValue: { status: "APPROVED", approvedBy: user.fullName },
      reason: "Location counts verified and approved by supervisor",
    });

    return NextResponse.json({ success: true, status: "APPROVED", location: updated[0] });
  } catch (error) {
    console.error("Location approve error:", error);
    return NextResponse.json({ error: "Failed to approve location" }, { status: 500 });
  }
}
