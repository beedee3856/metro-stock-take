import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username/Email and password are required" }, { status: 400 });
    }

    const matchedUsers = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);

    if (matchedUsers.length === 0) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const user = matchedUsers[0];

    if (!user.isActive) {
      return NextResponse.json({ error: "Account has been deactivated. Contact Administrator." }, { status: 403 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // Update last login
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // Audit log
    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      newValue: { ip: "127.0.0.1", userAgent: "Browser" },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        storeId: user.storeId,
      },
    });

    const cookieData = setSessionCookie(user.id);
    response.cookies.set(cookieData.name, cookieData.value, cookieData.options);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
