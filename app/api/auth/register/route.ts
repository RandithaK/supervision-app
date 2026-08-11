import "reflect-metadata";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserRepository, getOtpRepository } from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { signToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { EmailService } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, otp } = body;

    if (!name || !email || !password || !otp) {
      return NextResponse.json(
        { success: false, error: "Name, email, password, and OTP are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify OTP
    const otpRepo = await getOtpRepository();
    const otpRecord = await otpRepo.findOneBy({ email: normalizedEmail });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: "No verification code requested for this email." },
        { status: 404 }
      );
    }

    if (otpRecord.otp !== otp) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code." },
        { status: 401 }
      );
    }

    if (new Date() > otpRecord.expiresAt) {
      return NextResponse.json(
        { success: false, error: "Verification code has expired. Please request a new one." },
        { status: 410 }
      );
    }

    // 2. Check if user already exists (again, just to be safe)
    const userRepo = await getUserRepository();
    const existingUser = await userRepo.findOneBy({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // 3. Create the User (Forcing SUPERVISEE role for self-registration)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = userRepo.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: UserRole.SUPERVISEE, 
    });

    await userRepo.save(newUser);

    // 4. Delete the used OTP record to prevent replay
    await otpRepo.remove(otpRecord);

    // 5. Send Welcome Email (non-blocking)
    EmailService.sendEvent({
      eventType: "WELCOME_USER",
      to: newUser.email,
      payload: {
        userName: newUser.name,
        userEmail: newUser.email,
        userRole: newUser.role,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
      }
    }).catch(err => console.error("Failed to send welcome email:", err));

    // 6. Automatically log the user in
    const tokenPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
    };
    const token = await signToken(tokenPayload);

    const response = NextResponse.json(
      {
        success: true,
        message: "Registration successful",
        user: tokenPayload,
      },
      { status: 201 }
    );

    // Set HTTP-Only Cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Self registration error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to register user." },
      { status: 500 }
    );
  }
}
