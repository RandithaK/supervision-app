import "reflect-metadata";
import { NextResponse } from "next/server";
import { getUserRepository } from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { getAuthUser } from "@/lib/api-auth";

// PATCH /api/supervisor/profile (Update Supervisor areas of interest array)
export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (
      !authUser ||
      (authUser.role !== UserRole.SUPERVISOR &&
        authUser.role !== UserRole.ADMIN &&
        authUser.role !== UserRole.SUPERADMIN)
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Supervisor access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { areasOfInterest } = body;

    if (areasOfInterest !== undefined && !Array.isArray(areasOfInterest) && areasOfInterest !== null) {
      return NextResponse.json(
        { success: false, error: "areasOfInterest must be an array of strings." },
        { status: 400 }
      );
    }

    const userRepo = await getUserRepository();
    const user = await userRepo.findOneBy({ id: authUser.id });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    user.areasOfInterest = areasOfInterest;
    await userRepo.save(user);

    return NextResponse.json({
      success: true,
      message: "Areas of interest updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        areasOfInterest: user.areasOfInterest,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
