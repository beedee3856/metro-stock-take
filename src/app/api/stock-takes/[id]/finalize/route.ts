import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockTakes, stockTakeLocations, stockCounts, recounts, stockAdjustments, items } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "FINALIZE_STOCK_TAKE")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can finalize stock takes" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { generateAdjustments = false, overrideIncomplete = false } = body;

    const stRows = await db.select().from(stockTakes).where(eq(stockTakes.id, id)).limit(1);
    if (stRows.length === 0) {
      return NextResponse.json({ error: "Stock Take not found" }, { status: 404 });
    }

    const st = stRows[0];
    if (st.status === "FINALIZED") {
      return NextResponse.json({ error: "Stock Take is already finalized" }, { status: 400 });
    }

    // Check pending recounts
    const pendingRecounts = await db
      .select()
      .from(recounts)
      .where(and(eq(recounts.stockTakeId, id), eq(recounts.status, "PENDING")));

    if (pendingRecounts.length > 0 && !overrideIncomplete) {
      return NextResponse.json(
        {
          error: `Cannot finalize: ${pendingRecounts.length} pending recount(s) must be resolved or cancelled first.`,
        },
        { status: 400 }
      );
    }

    // Check unapproved locations
    const unapprovedLocations = await db
      .select()
      .from(stockTakeLocations)
      .where(and(eq(stockTakeLocations.stockTakeId, id), eq(stockTakeLocations.status, "NOT_ASSIGNED")));

    if (unapprovedLocations.length > 0 && !overrideIncomplete) {
      return NextResponse.json(
        {
          error: `Cannot finalize: ${unapprovedLocations.length} location(s) have not been counted or submitted. Enable override if intentional.`,
        },
        { status: 400 }
      );
    }

    // Lock and Finalize Stock Take
    const now = new Date();
    await db
      .update(stockTakes)
      .set({
        status: "FINALIZED",
        isLocked: true,
        lockedAt: now,
        lockedBy: user.id,
        finalizedAt: now,
        finalizedBy: user.id,
        updatedAt: now,
      })
      .where(eq(stockTakes.id, id));

    // Mark all locations as COMPLETED/LOCKED
    await db
      .update(stockTakeLocations)
      .set({ status: "COMPLETED", updatedAt: now })
      .where(eq(stockTakeLocations.stockTakeId, id));

    let adjustmentsCount = 0;
    // Optional controlled stock adjustment creation
    if (generateAdjustments) {
      const countsWithVariance = await db
        .select()
        .from(stockCounts)
        .where(eq(stockCounts.stockTakeId, id));

      for (const count of countsWithVariance) {
        if (count.varianceQuantity !== 0) {
          // Record adjustment
          await db.insert(stockAdjustments).values({
            stockTakeId: id,
            itemId: count.itemId,
            locationId: count.stockTakeLocationId,
            previousStock: count.systemQuantity,
            adjustmentQty: count.varianceQuantity,
            newStock: count.physicalQuantity,
            reason: `Finalized Stock Take ${st.stockTakeNumber} Variance Adjustment`,
            approvedBy: user.id,
            status: "APPLIED",
          });

          // Update current system stock on item master
          await db
            .update(items)
            .set({ currentSystemStock: count.physicalQuantity, updatedAt: now })
            .where(eq(items.id, count.itemId));

          adjustmentsCount++;
        }
      }
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "FINALIZE_STOCK_TAKE",
      entityType: "STOCK_TAKE",
      entityId: id,
      newValue: {
        stockTakeNumber: st.stockTakeNumber,
        status: "FINALIZED",
        adjustmentsGenerated: adjustmentsCount,
      },
      reason: `Stock take ${st.stockTakeNumber} finalized and locked.`,
    });

    return NextResponse.json({
      success: true,
      message: `Stock Take ${st.stockTakeNumber} finalized successfully.`,
      adjustmentsCount,
    });
  } catch (error) {
    console.error("Stock take finalize error:", error);
    return NextResponse.json({ error: "Failed to finalize stock take" }, { status: 500 });
  }
}
