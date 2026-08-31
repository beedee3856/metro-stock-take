import { NextResponse } from "next/server";
import { db } from "@/db";
import { recounts, stockCounts, stockTakeLocations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "APPROVE_RECOUNT")) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to reject recounts" }, { status: 403 });
    }

    const body = await req.json();
    const { recountId, rejectionReason = "" } = body;

    if (!recountId) {
      return NextResponse.json({ error: "recountId is required" }, { status: 400 });
    }

    if (!rejectionReason) {
      return NextResponse.json({ error: "rejectionReason is required" }, { status: 400 });
    }

    const recRows = await db.select().from(recounts).where(eq(recounts.id, recountId)).limit(1);
    if (recRows.length === 0) {
      return NextResponse.json({ error: "Recount record not found" }, { status: 404 });
    }
    const rec = recRows[0];

    // Recount must be COMPLETED to be rejected
    if (rec.status !== "COMPLETED") {
      return NextResponse.json({ error: `Cannot reject recount with status: ${rec.status}. Must be COMPLETED.` }, { status: 400 });
    }

    const now = new Date();

    // Reset recount to IN_PROGRESS for stock taker to recount
    const updated = await db
      .update(recounts)
      .set({
        status: "IN_PROGRESS",
        // Reset the recount quantities so stock taker can count again
        recountPhysicalQty: null,
        difference: null,
        finalQuantity: null,
        notes: `${rec.notes || ""}\n[REJECTED] ${rejectionReason}\n[RESENT TO STOCK TAKER FOR RECOUNT]`,
        updatedAt: now,
      })
      .where(eq(recounts.id, recountId))
      .returning();

    // Reset the stock count status to RECOUNT_REQUIRED
    if (rec.originalStockCountId) {
      await db
        .update(stockCounts)
        .set({
          countStatus: "RECOUNT_REQUIRED",
          notes: `${rec.notes || ""}\n[REJECTED BY SUPERVISOR - REASON: ${rejectionReason}]\n[RESENT TO STOCK TAKER]`,
          updatedAt: now,
        })
        .where(eq(stockCounts.id, rec.originalStockCountId));
    }

    // Update location status back to IN_PROGRESS so stock taker knows to work on it again
    await db
      .update(stockTakeLocations)
      .set({ 
        status: "IN_PROGRESS", 
        updatedAt: now 
      })
      .where(eq(stockTakeLocations.id, rec.stockTakeLocationId));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "RECOUNT_REJECTED",
      entityType: "RECOUNT",
      entityId: recountId,
      previousValue: { status: "COMPLETED", finalQuantity: rec.finalQuantity },
      newValue: { status: "IN_PROGRESS", reason: rejectionReason },
      reason: `Recount rejected and sent back to stock taker. Reason: ${rejectionReason}`,
    });

    return NextResponse.json({ success: true, recount: updated[0] });
  } catch (error) {
    console.error("Recount rejection error:", error);
    return NextResponse.json({ error: "Failed to reject recount" }, { status: 500 });
  }
}
