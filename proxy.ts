import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "supervision-app-super-secret-jwt-key-2026"
);

const AUTH_COOKIE_NAME = "auth_token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedAdmin = pathname.startsWith("/admin");
  const isProtectedSupervisor = pathname.startsWith("/supervisor");
  const isProtectedSupervisee = pathname.startsWith("/supervisee");

  if (!isProtectedAdmin && !isProtectedSupervisor && !isProtectedSupervisee) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    // Role-based route authorization check
    if (isProtectedAdmin && role !== "ADMIN" && role !== "SUPERADMIN") {
      const targetPath = role === "SUPERVISOR" ? "/supervisor" : "/supervisee";
      return NextResponse.redirect(new URL(targetPath, request.url));
    }

    if (isProtectedSupervisor && role !== "SUPERVISOR") {
      const targetPath = (role === "ADMIN" || role === "SUPERADMIN") ? "/admin" : "/supervisee";
      return NextResponse.redirect(new URL(targetPath, request.url));
    }

    if (isProtectedSupervisee && role !== "SUPERVISEE") {
      const targetPath = (role === "ADMIN" || role === "SUPERADMIN") ? "/admin" : "/supervisor";
      return NextResponse.redirect(new URL(targetPath, request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // Invalid/expired token
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/supervisor/:path*", "/supervisee/:path*"],
};
