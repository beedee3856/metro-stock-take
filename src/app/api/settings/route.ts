import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.select().from(systemSettings);
    const configMap: Record<string, unknown> = {};

    rows.forEach((r) => {
      try {
        configMap[r.key] = JSON.parse(r.value);
      } catch {
        configMap[r.key] = r.value;
      }
    });

    return NextResponse.json({ settings: configMap, raw: rows });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_SETTINGS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can modify settings" }, { status: 403 });
    }

    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "Setting key is required" }, { status: 400 });
    }

    const strVal = JSON.stringify(value);

    await db
      .insert(systemSettings)
      .values({
        key,
        value: strVal,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: strVal,
          updatedBy: user.id,
          updatedAt: new Date(),
        },
      });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "SETTING_UPDATE",
      entityType: "SETTING",
      entityId: key,
      newValue: value,
      reason: `Setting ${key} updated`,
    });

    return NextResponse.json({ success: true, key, value });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
