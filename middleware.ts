import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "st_session_user";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/api/auth/login", "/api/auth/logout", "/api/health", "/api/seed"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow API routes that don't require auth
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow /api/auth/me to check authentication status
  if (pathname.startsWith("/api/auth/me")) {
    return NextResponse.next();
  }

  // For API routes (except public ones), check authentication
  if (pathname.startsWith("/api/")) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // For page routes (non-API), allow all to go through
  // The frontend will handle redirects to login if not authenticated
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
