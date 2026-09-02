import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakeLocations, users, locations, stockTakes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "ASSIGN_STOCK_TAKERS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators and supervisors can assign stock takers" }, { status: 403 });
    }

    const { id: stockTakeId } = await params;
    const body = await req.json();
    const { stockTakeLocationId, assignedUserId, verifierUserId, notes } = body;

    if (!stockTakeLocationId) {
      return NextResponse.json({ error: "stockTakeLocationId is required" }, { status: 400 });
    }

    const stlRows = await db
      .select()
      .from(stockTakeLocations)
      .where(and(eq(stockTakeLocations.id, stockTakeLocationId), eq(stockTakeLocations.stockTakeId, stockTakeId)))
      .limit(1);

    if (stlRows.length === 0) {
      return NextResponse.json({ error: "Stock take location record not found" }, { status: 404 });
    }

    const prevAssignment = stlRows[0];

    // Determine new status
    let newStatus = prevAssignment.status;
    if (assignedUserId && prevAssignment.status === "NOT_ASSIGNED") {
      newStatus = "ASSIGNED";
    }

    const updated = await db
      .update(stockTakeLocations)
      .set({
        assignedUserId: assignedUserId || null,
        verifierUserId: verifierUserId || prevAssignment.verifierUserId,
        status: newStatus,
        notes: notes !== undefined ? notes : prevAssignment.notes,
        updatedAt: new Date(),
      })
      .where(eq(stockTakeLocations.id, stockTakeLocationId))
      .returning();

    // Fetch user details for audit
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
      entityId: stockTakeLocationId,
      previousValue: { assignedUserId: prevAssignment.assignedUserId },
      newValue: { assignedUserId, assignedUserName, status: newStatus },
      reason: `Assigned location to ${assignedUserName}`,
    });

    return NextResponse.json({ success: true, assignment: updated[0] });
  } catch (error) {
    console.error("Assignment error:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
