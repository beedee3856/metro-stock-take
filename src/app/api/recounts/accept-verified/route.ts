import { NextResponse } from "next/server";
import { db } from "@/db";
import { recounts, stockCounts, items, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "APPROVE_COUNTS")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { recountId, verificationNotes } = body;

    if (!recountId) {
      return NextResponse.json({ error: "Missing recountId" }, { status: 400 });
    }

    // Get the recount record
    const recountRows = await db.select().from(recounts).where(eq(recounts.id, recountId)).limit(1);
    if (recountRows.length === 0) {
      return NextResponse.json({ error: "Recount not found" }, { status: 404 });
    }

    const recount = recountRows[0];

    // If system stock < physical stock and recount confirms it, mark as ACCEPTED_VERIFIED
    const isSystemLessThanPhysical = recount.systemQty < (recount.recountPhysicalQty || 0);

    const now = new Date();
    const updated = await db
      .update(recounts)
      .set({
        status: "ACCEPTED_VERIFIED",
        resolvedBy: user.id,
        resolvedAt: now,
        notes: verificationNotes || recount.notes,
        updatedAt: now,
      })
      .where(eq(recounts.id, recountId))
      .returning();

    // Update stock count with variance indicator
    if (recount.originalStockCountId) {
      const item = await db.select().from(items).where(eq(items.id, recount.itemId)).limit(1);
      const costNum = item.length > 0 ? Number(item[0].costPrice) || 0 : 0;
      const finalQty = recount.recountPhysicalQty || recount.originalPhysicalQty;
      const varianceQty = finalQty - recount.systemQty;
      const varianceVal = (varianceQty * costNum).toFixed(2);
      const variancePct = recount.systemQty > 0 ? ((varianceQty / recount.systemQty) * 100).toFixed(2) : "0.00";

      await db
        .update(stockCounts)
        .set({
          physicalQuantity: finalQty,
          varianceQuantity: varianceQty,
          varianceValue: varianceVal,
          variancePercentage: variancePct,
          countStatus: "APPROVED",
          countRound: 2,
          notes: `Recount accepted by admin. System: ${recount.systemQty}, Recount: ${recount.recountPhysicalQty}, Final: ${finalQty}. Variance confirmed and accepted.`,
          updatedAt: now,
        })
        .where(eq(stockCounts.id, recount.originalStockCountId));
    }

    // Notify the stock taker
    if (recount.assignedTo) {
      await db.insert(notifications).values({
        userId: recount.assignedTo,
        title: "Recount Accepted",
        message: `Your recount verification has been accepted and approved by admin.`,
        type: "APPROVAL",
        link: `/recounts?status=ACCEPTED_VERIFIED`,
      });
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "RECOUNT_ACCEPTED",
      entityType: "RECOUNT",
      entityId: recountId,
      newValue: {
        status: "ACCEPTED_VERIFIED",
        isSystemLessThanPhysical,
        verificationNotes,
      },
      reason: verificationNotes || "Recount variance accepted and approved",
    });

    return NextResponse.json({ success: true, recount: updated[0] });
  } catch (error) {
    console.error("Accept verified error:", error);
    return NextResponse.json({ error: "Failed to accept verified recount" }, { status: 500 });
  }
}
