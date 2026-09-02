import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, ne, and, or } from "drizzle-orm";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ profile: rows[0] });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullName, username, email, password, phone } = body;

    const existingRows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const current = existingRows[0];

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Update Full Name
    if (fullName && fullName.trim()) {
      updateFields.fullName = fullName.trim();
    }

    // Update Username (verify uniqueness)
    if (username && username.trim() && username.trim() !== current.username) {
      const trimmedUser = username.trim();
      const conflict = await db
        .select()
        .from(users)
        .where(and(eq(users.username, trimmedUser), ne(users.id, user.id)))
        .limit(1);

      if (conflict.length > 0) {
        return NextResponse.json({ error: `Username '${trimmedUser}' is already taken.` }, { status: 409 });
      }
      updateFields.username = trimmedUser;
    }

    // Update Email (verify uniqueness)
    if (email && email.trim() && email.trim().toLowerCase() !== current.email.toLowerCase()) {
      const trimmedEmail = email.trim().toLowerCase();
      const conflict = await db
        .select()
        .from(users)
        .where(and(eq(users.email, trimmedEmail), ne(users.id, user.id)))
        .limit(1);

      if (conflict.length > 0) {
        return NextResponse.json({ error: `Email '${trimmedEmail}' is already registered.` }, { status: 409 });
      }
      updateFields.email = trimmedEmail;
    }

    // Update Phone
    if (phone !== undefined) {
      updateFields.phone = phone?.trim() || null;
    }

    // Update Password
    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
      }
      const newHash = await hashPassword(password.trim());
      updateFields.passwordHash = newHash;
    }

    const updated = await db.update(users).set(updateFields).where(eq(users.id, user.id)).returning();
    const updatedUser = updated[0];

    await logAudit({
      userId: user.id,
      userName: updatedUser.fullName,
      userRole: updatedUser.role,
      action: "ADMIN_PROFILE_UPDATE",
      entityType: "USER",
      entityId: user.id,
      previousValue: { fullName: current.fullName, username: current.username, email: current.email },
      newValue: {
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        email: updatedUser.email,
        passwordChanged: !!(password && password.trim()),
      },
      reason: "Administrator name and password updated in database",
    });

    return NextResponse.json({
      success: true,
      message: "Administrator profile and password updated successfully in PostgreSQL database.",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Admin profile update error:", error);
    return NextResponse.json({ error: "Failed to update administrator profile" }, { status: 500 });
  }
}
