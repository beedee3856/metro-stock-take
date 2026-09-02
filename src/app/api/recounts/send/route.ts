import { NextResponse } from "next/server";
import { db } from "@/db";
import { recounts, notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "REQUEST_RECOUNT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { recountId, assignedToUserId, notes } = body;

    if (!recountId || !assignedToUserId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Get the recount record
    const recountRows = await db.select().from(recounts).where(eq(recounts.id, recountId)).limit(1);
    if (recountRows.length === 0) {
      return NextResponse.json({ error: "Recount not found" }, { status: 404 });
    }

    const recount = recountRows[0];

    // Update recount status to ASSIGNED
    const updated = await db
      .update(recounts)
      .set({
        assignedTo: assignedToUserId,
        status: "ASSIGNED",
        notes: notes || recount.notes,
        updatedAt: new Date(),
      })
      .where(eq(recounts.id, recountId))
      .returning();

    // Create notification for stock taker
    await db.insert(notifications).values({
      userId: assignedToUserId,
      title: "Recount Assigned",
      message: `A recount has been assigned to you. Please re-verify and submit the count.`,
      type: "RECOUNT",
      link: `/recounts?status=ASSIGNED`,
    });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "RECOUNT_SENT",
      entityType: "RECOUNT",
      entityId: recountId,
      newValue: { status: "ASSIGNED", assignedTo: assignedToUserId },
      reason: notes || "Recount sent to stock taker for verification",
    });

    return NextResponse.json({ success: true, recount: updated[0] });
  } catch (error) {
    console.error("Send recount error:", error);
    return NextResponse.json({ error: "Failed to send recount" }, { status: 500 });
  }
}
