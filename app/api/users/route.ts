import "reflect-metadata";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserRepository } from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

// GET /api/users - List users (Admin/SuperAdmin only)
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // Only ADMIN and SUPERADMIN can list all users
    if (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const userRepository = await getUserRepository();

    const users = await userRepository.find({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: "DESC" },
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user (Admin/SuperAdmin only)
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    // Only ADMIN and SUPERADMIN can create users
    if (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Only Admins can register new users." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, email, password, role" },
        { status: 400 }
      );
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${Object.values(UserRole).join(", ")}` },
        { status: 400 }
      );
    }

    // ADMIN cannot create ADMIN or SUPERADMIN (Only SUPERADMIN can create ADMIN or SUPERADMIN)
    if (
      (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) &&
      authUser.role !== UserRole.SUPERADMIN
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden. Only a SuperAdmin can create Admin or SuperAdmin accounts.",
        },
        { status: 403 }
      );
    }

    const userRepository = await getUserRepository();

    // Check if email already exists
    const existing = await userRepository.findOneBy({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = userRepository.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
    });

    await userRepository.save(newUser);

    // Non-blocking email dispatch for key event WELCOME_USER
    EmailService.sendEvent({
      eventType: "WELCOME_USER",
      to: newUser.email,
      payload: {
        userName: newUser.name,
        userEmail: newUser.email,
        userRole: newUser.role,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
      }
    }).catch((err) => {
      console.error("Failed to send welcome email:", err);
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create user API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
