import { cookies } from "next/headers";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

/**
 * Shared helper: extract & verify the auth token from cookie or
 * Authorization header, then return the decoded JWT payload (or null).
 */
export async function getAuthUser(request: Request) {
  const cookieStore = await cookies();
  let token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;
  return await verifyToken(token);
}
