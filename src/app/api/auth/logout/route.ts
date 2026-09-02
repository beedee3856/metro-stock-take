import { NextResponse } from "next/server";
import { getCurrentUser, clearSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await logAudit({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
        action: "LOGOUT",
        entityType: "USER",
        entityId: user.id,
      });
    }

    const response = NextResponse.json({ success: true });
    const cookieData = clearSessionCookie();
    response.cookies.set(cookieData.name, cookieData.value, cookieData.options);
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
