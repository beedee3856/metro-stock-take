import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, stores } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser, hasPermission, hashPassword } from "@/lib/auth";
import { isPasswordStrong } from "@/lib/passwordValidation";
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
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        storeId: users.storeId,
        storeName: stores.name,
      })
      .from(users)
      .leftJoin(stores, eq(users.storeId, stores.id))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: rows });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_USERS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can create users" }, { status: 403 });
    }

    const body = await req.json();
    const { username, email, password, fullName, role, phone, storeId } = body;

    if (!username || !email || !password || !fullName || !role) {
      return NextResponse.json({ error: "Missing required user fields" }, { status: 400 });
    }

    // Validate password strength
    if (!isPasswordStrong(password)) {
      return NextResponse.json(
        {
          error: "Password does not meet requirements. Must contain ALL of the following: 8+ characters, uppercase letter, lowercase letter, number, and special character (!@#$%^&*).",
        },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const inserted = await db
      .insert(users)
      .values({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        role,
        phone: phone?.trim() || null,
        storeId: storeId || null,
        isActive: true,
      })
      .returning();

    const newUser = inserted[0];

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "USER_CREATE",
      entityType: "USER",
      entityId: newUser.id,
      newValue: { username: newUser.username, role: newUser.role, fullName: newUser.fullName },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_USERS")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { id, fullName, username, email, role, phone, isActive, newPassword } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Validate new password strength if provided
    if (newPassword && newPassword.trim()) {
      if (!isPasswordStrong(newPassword.trim())) {
        return NextResponse.json(
          {
            error: "New password does not meet requirements. Must contain ALL of the following: 8+ characters, uppercase letter, lowercase letter, number, and special character (!@#$%^&*).",
          },
          { status: 400 }
        );
      }
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (fullName) updateFields.fullName = fullName.trim();
    if (username) updateFields.username = username.trim();
    if (email) updateFields.email = email.trim().toLowerCase();
    if (role) updateFields.role = role;
    if (phone !== undefined) updateFields.phone = phone?.trim() || null;
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (newPassword && newPassword.trim()) {
      updateFields.passwordHash = await hashPassword(newPassword.trim());
    }

    const updated = await db.update(users).set(updateFields).where(eq(users.id, id)).returning();

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "USER_UPDATE",
      entityType: "USER",
      entityId: id,
      newValue: { role, isActive, passwordReset: !!newPassword },
    });

    return NextResponse.json({ success: true, user: updated[0] });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(user.role, "MANAGE_USERS")) {
      return NextResponse.json({ error: "Forbidden: Only administrators can delete users" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Prevent deleting the current user
    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Delete the user
    const deletedUser = await db.delete(users).where(eq(users.id, userId)).returning();

    if (deletedUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      userRole: user.role,
      action: "USER_DELETE",
      entityType: "USER",
      entityId: userId,
      oldValue: { username: deletedUser[0].username, role: deletedUser[0].role, fullName: deletedUser[0].fullName },
    });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("User deletion error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
