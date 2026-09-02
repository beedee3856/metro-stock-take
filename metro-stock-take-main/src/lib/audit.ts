import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export interface LogAuditParams {
  userId?: string | null;
  userName: string;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
}

export async function logAudit(params: LogAuditParams) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId || null,
      userName: params.userName,
      userRole: params.userRole || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ? String(params.entityId) : null,
      previousValue: params.previousValue ? JSON.stringify(params.previousValue) : null,
      newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      reason: params.reason || null,
      ipAddress: params.ipAddress || null,
      deviceInfo: params.deviceInfo || null,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
