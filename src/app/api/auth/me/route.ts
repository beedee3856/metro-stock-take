import { NextResponse } from "next/server";
import { getCurrentUser, clearSessionCookie, setSessionCookie } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

// GET /api/auth/me
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, user });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ authenticated: false, error: "Failed to authenticate" }, { status: 500 });
  }
}
