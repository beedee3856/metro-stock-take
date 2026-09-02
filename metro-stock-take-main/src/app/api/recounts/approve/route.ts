import { NextResponse } from "next/server";
import { db } from "@/db";
import { recounts, stockCounts, stockTakeLocations, items } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "APPROVE_RECOUNT")) {
      return NextResponse.json({ error: "Forbidden: You are not authorized to approve recounts" }, { status: 403 });
    }

    const body = await req.json();
    const { recountId, approvalNotes = "" } = body;

    if (!recountId) {
      return NextResponse.json({ error: "recountId is required" }, { status: 400 });
    }

    const recRows = await db.select().from(recounts).where(eq(recounts.id, recountId)).limit(1);
    if (recRows.length === 0) {
      return NextResponse.json({ error: "Recount record not found" }, { status: 404 });
    }
    const rec = recRows[0];

    // Recount must be COMPLETED to be approved
    if (rec.status !== "COMPLETED") {
      return NextResponse.json({ error: `Cannot approve recount with status: ${rec.status}. Must be COMPLETED.` }, { status: 400 });
    }

    const now = new Date();

    // Update recount status to APPROVED
    const updated = await db
      .update(recounts)
      .set({
        status: "APPROVED",
        notes: approvalNotes ? `${rec.notes || ""}\n[APPROVED] ${approvalNotes}` : rec.notes,
        updatedAt: now,
      })
      .where(eq(recounts.id, recountId))
      .returning();

    // Update the stock count to APPROVED
    if (rec.originalStockCountId) {
      await db
        .update(stockCounts)
        .set({
          countStatus: "APPROVED",
          notes: `${rec.notes || ""}\n[APPROVED BY SUPERVISOR] ${approvalNotes || "Recount approved"}`,
          updatedAt: now,
        })
        .where(eq(stockCounts.id, rec.originalStockCountId));
    }

    // Check if all recounts for this location are now approved
    const pendingRecounts = await db
      .select()
      .from(recounts)
      .where(
        and(
          eq(recounts.stockTakeLocationId, rec.stockTakeLocationId),
          eq(recounts.status, "COMPLETED")
        )
      );

    // If no more COMPLETED recounts, update location status to SUBMITTED or APPROVED
    if (pendingRecounts.length === 0) {
      await db
        .update(stockTakeLocations)
        .set({ 
          status: "APPROVED", 
          approvedBy: user.id,
          approvedAt: now,
          updatedAt: now 
        })
        .where(eq(stockTakeLocations.id, rec.stockTakeLocationId));
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "RECOUNT_APPROVED",
      entityType: "RECOUNT",
      entityId: recountId,
      newValue: { status: "APPROVED", finalQuantity: rec.finalQuantity, approvalNotes },
      reason: approvalNotes || "Recount approved by supervisor",
    });

    return NextResponse.json({ success: true, recount: updated[0] });
  } catch (error) {
    console.error("Recount approval error:", error);
    return NextResponse.json({ error: "Failed to approve recount" }, { status: 500 });
  }
}
