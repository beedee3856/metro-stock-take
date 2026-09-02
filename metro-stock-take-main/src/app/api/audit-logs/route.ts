import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { eq, or, ilike, and, desc } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "VIEW_AUDIT_LOGS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators and auditors can view audit logs" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const query = searchParams.get("query")?.trim();

    const conditions = [];
    if (action && action !== "ALL") conditions.push(eq(auditLogs.action, action));
    if (entityType && entityType !== "ALL") conditions.push(eq(auditLogs.entityType, entityType));
    if (query) {
      conditions.push(
        or(
          ilike(auditLogs.userName, `%${query}%`),
          ilike(auditLogs.action, `%${query}%`),
          ilike(auditLogs.reason, `%${query}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    return NextResponse.json({ logs: rows });
  } catch (error) {
    console.error("Audit log error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
