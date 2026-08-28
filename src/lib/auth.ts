import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Role = "ADMINISTRATOR" | "SUPERVISOR" | "STOCK_TAKER" | "STORE_MANAGER" | "AUDITOR";

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  storeId?: string | null;
  isActive: boolean;
}

export const PERMISSIONS = {
  VIEW_DASHBOARD: ["ADMINISTRATOR", "SUPERVISOR", "STOCK_TAKER", "STORE_MANAGER", "AUDITOR"],
  VIEW_ITEMS: ["ADMINISTRATOR", "SUPERVISOR", "STOCK_TAKER", "STORE_MANAGER", "AUDITOR"],
  MANAGE_ITEMS: ["ADMINISTRATOR"],
  IMPORT_ITEMS: ["ADMINISTRATOR"],
  VIEW_LOCATIONS: ["ADMINISTRATOR", "SUPERVISOR", "STOCK_TAKER", "STORE_MANAGER", "AUDITOR"],
  MANAGE_LOCATIONS: ["ADMINISTRATOR"],
  VIEW_STOCK_TAKES: ["ADMINISTRATOR", "SUPERVISOR", "STOCK_TAKER", "STORE_MANAGER", "AUDITOR"],
  MANAGE_STOCK_TAKES: ["ADMINISTRATOR"],
  ASSIGN_STOCK_TAKERS: ["ADMINISTRATOR", "SUPERVISOR"],
  COUNT_STOCK: ["STOCK_TAKER", "SUPERVISOR", "ADMINISTRATOR"],
  REQUEST_RECOUNT: ["ADMINISTRATOR", "SUPERVISOR", "STORE_MANAGER"],
  APPROVE_COUNTS: ["ADMINISTRATOR", "SUPERVISOR", "STORE_MANAGER"],
  FINALIZE_STOCK_TAKE: ["ADMINISTRATOR"],
  UNLOCK_STOCK_TAKE: ["ADMINISTRATOR"],
  VIEW_REPORTS: ["ADMINISTRATOR", "SUPERVISOR", "STORE_MANAGER", "AUDITOR"],
  EXPORT_REPORTS: ["ADMINISTRATOR", "SUPERVISOR", "STORE_MANAGER", "AUDITOR"],
  VIEW_AUDIT_LOGS: ["ADMINISTRATOR", "AUDITOR"],
  MANAGE_USERS: ["ADMINISTRATOR"],
  MANAGE_SETTINGS: ["ADMINISTRATOR"],
} as const;

export function hasPermission(role: Role, permission: keyof typeof PERMISSIONS): boolean {
  const allowed = PERMISSIONS[permission];
  return (allowed as readonly string[]).includes(role);
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

const SESSION_COOKIE_NAME = "st_session_user";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return null;
    }

    // Cookie contains user ID
    const userId = sessionCookie.value;
    const userRecords = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        storeId: users.storeId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRecords.length === 0 || !userRecords[0].isActive) {
      return null;
    }

    const u = userRecords[0];
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      role: u.role as Role,
      storeId: u.storeId,
      isActive: u.isActive,
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(userId: string): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: SESSION_COOKIE_NAME,
    value: userId,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  };
}

export function clearSessionCookie(): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    },
  };
}
