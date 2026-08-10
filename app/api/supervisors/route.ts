import "reflect-metadata";
import { NextResponse } from "next/server";
import { getUserRepository } from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { getAuthUser } from "@/lib/api-auth";

// GET /api/supervisors - List all supervisors with areas of interest array
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userRepo = await getUserRepository();
    const rawSupervisors = await userRepo.find({
      where: { role: UserRole.SUPERVISOR },
      order: { name: "ASC" },
    });

    const supervisors = rawSupervisors.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      areasOfInterest: Array.isArray(s.areasOfInterest)
        ? s.areasOfInterest
        : typeof s.areasOfInterest === "string"
        ? (s.areasOfInterest as string).split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ success: true, supervisors });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch supervisors" },
      { status: 500 }
    );
  }
}
