import "reflect-metadata";
import { NextResponse } from "next/server";
import { getUserRepository, getProgramSupervisorRepository } from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { getAuthUser } from "@/lib/api-auth";

// GET /api/supervisors - List all supervisors or filter by program
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const programId = url.searchParams.get("programId");

    let supervisorsList: any[] = [];

    if (programId) {
      const programSupervisorRepo = await getProgramSupervisorRepository();
      const whereCondition: any = { programId };
      if (authUser.role === UserRole.SUPERVISEE) {
        whereCondition.status = ProgramParticipantStatus.ACTIVE;
      }
      const memberships = await programSupervisorRepo.find({
        where: whereCondition,
        relations: { supervisor: true },
      });

      supervisorsList = memberships
        .filter((m) => m.supervisor)
        .map((m) => ({
          ...m.supervisor,
          membershipStatus: m.status,
          joinedProgramAt: m.joinedAt,
        }));
    } else {
      const userRepo = await getUserRepository();
      supervisorsList = await userRepo.find({
        where: { role: UserRole.SUPERVISOR },
        order: { name: "ASC" },
      });
    }

    const supervisors = supervisorsList.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      membershipStatus: s.membershipStatus,
      joinedProgramAt: s.joinedProgramAt,
      areasOfInterest: Array.isArray(s.areasOfInterest)
        ? s.areasOfInterest
        : typeof s.areasOfInterest === "string"
        ? (s.areasOfInterest as string).split(",").map((t: string) => t.trim()).filter(Boolean)
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
