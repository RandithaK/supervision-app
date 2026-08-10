import { SignJWT, jwtVerify } from "jose";
import { UserRole } from "@/lib/db/entities/User";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "supervision-app-super-secret-jwt-key-2026"
);

export const AUTH_COOKIE_NAME = "auth_token";

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  [key: string]: unknown;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}
