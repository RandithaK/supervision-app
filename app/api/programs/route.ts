import "reflect-metadata";
import { NextResponse } from "next/server";
import { In } from "typeorm";
import {
  getProgramRepository,
  getProgramSupervisorRepository,
  getProgramSuperviseeRepository,
  getUserRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ProgramStatus } from "@/lib/db/entities/Program";
import { ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

// GET /api/programs — List programs based on user role
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const programRepo = await getProgramRepository();
    const programSupervisorRepo = await getProgramSupervisorRepository();
    const programSuperviseeRepo = await getProgramSuperviseeRepository();

    let programs;

    if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPERADMIN) {
      // Admins see all programs
      programs = await programRepo.find({
        relations: { createdBy: true },
        order: { createdAt: "DESC" },
      });
    } else if (authUser.role === UserRole.SUPERVISOR) {
      // Supervisors see ACTIVE + DRAFT programs (not ARCHIVED unless they're in it)
      programs = await programRepo.find({
        relations: { createdBy: true },
        order: { createdAt: "DESC" },
      });
      // Filter: ACTIVE, DRAFT, or ARCHIVED-only-if-member
      const memberships = await programSupervisorRepo.find({
        where: { supervisorId: authUser.id },
      });
      const memberProgramIds = new Set(memberships.map((m) => m.programId));
      programs = programs.filter(
        (p) =>
          p.status === ProgramStatus.ACTIVE ||
          p.status === ProgramStatus.DRAFT ||
          memberProgramIds.has(p.id)
      );
    } else {
      // Supervisees see only ACTIVE programs (DRAFT is hidden from them)
      programs = await programRepo.find({
        where: { status: ProgramStatus.ACTIVE },
        relations: { createdBy: true },
        order: { createdAt: "DESC" },
      });
      // Also include archived programs they're in
      const memberships = await programSuperviseeRepo.find({
        where: { superviseeId: authUser.id },
      });
      const memberProgramIds = new Set(memberships.map((m) => m.programId));
      const archivedPrograms = await programRepo.find({
        where: { status: ProgramStatus.ARCHIVED },
        relations: { createdBy: true },
      });
      for (const ap of archivedPrograms) {
        if (memberProgramIds.has(ap.id)) {
          programs.push(ap);
        }
      }
    }

    if (programs.length === 0) {
      return NextResponse.json({ success: true, programs: [] });
    }

    // Bulk-fetch participant memberships to eliminate N+1 query waterfall
    const programIds = programs.map((p) => p.id);

    const [activeSupMemberships, supveeMemberships] = await Promise.all([
      programSupervisorRepo.find({
        where: { programId: In(programIds), status: ProgramParticipantStatus.ACTIVE },
      }),
      programSuperviseeRepo.find({
        where: { programId: In(programIds) },
      }),
    ]);

    const supervisorCountMap = new Map<string, number>();
    for (const m of activeSupMemberships) {
      supervisorCountMap.set(m.programId, (supervisorCountMap.get(m.programId) || 0) + 1);
    }

    const superviseeCountMap = new Map<string, number>();
    for (const m of supveeMemberships) {
      superviseeCountMap.set(m.programId, (superviseeCountMap.get(m.programId) || 0) + 1);
    }

    // Fetch user-specific memberships across all programs in one query
    const userMembershipMap = new Map<string, { status: string; joinedAt: Date }>();
    if (authUser.role === UserRole.SUPERVISOR) {
      const myMemberships = await programSupervisorRepo.find({
        where: { programId: In(programIds), supervisorId: authUser.id },
      });
      for (const m of myMemberships) {
        userMembershipMap.set(m.programId, { status: m.status, joinedAt: m.joinedAt });
      }
    } else if (authUser.role === UserRole.SUPERVISEE) {
      const myMemberships = await programSuperviseeRepo.find({
        where: { programId: In(programIds), superviseeId: authUser.id },
      });
      for (const m of myMemberships) {
        userMembershipMap.set(m.programId, { status: "ACTIVE", joinedAt: m.joinedAt });
      }
    }

    const enriched = programs.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      createdBy: p.createdBy
        ? { id: p.createdBy.id, name: p.createdBy.name, email: p.createdBy.email }
        : null,
      supervisorCount: supervisorCountMap.get(p.id) || 0,
      superviseeCount: superviseeCountMap.get(p.id) || 0,
      userMembership: userMembershipMap.get(p.id) || null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({ success: true, programs: enriched });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch programs" },
      { status: 500 }
    );
  }
}

// POST /api/programs — Create a new program (Admin/SuperAdmin only)
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (
      !authUser ||
      (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN)
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Only Admins can create programs." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, status } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Program name is required." },
        { status: 400 }
      );
    }

    const validStatuses = [ProgramStatus.DRAFT, ProgramStatus.ACTIVE];
    const programStatus = status && validStatuses.includes(status) ? status : ProgramStatus.ACTIVE;

    const programRepo = await getProgramRepository();
    const newProgram = programRepo.create({
      name,
      description: description || null,
      status: programStatus,
      createdById: authUser.id,
    });

    await programRepo.save(newProgram);

    // If program is created directly as ACTIVE, notify supervisors
    if (programStatus === ProgramStatus.ACTIVE) {
      const userRepo = await getUserRepository();
      const supervisors = await userRepo.find({ where: { role: UserRole.SUPERVISOR } });
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisor`;

      for (const sup of supervisors) {
        if (sup.email) {
          EmailService.sendEvent({
            eventType: "PROGRAM_CREATED",
            to: sup.email,
            payload: {
              recipientName: sup.name,
              programName: newProgram.name,
              programDescription: newProgram.description || "No description provided.",
              programStatus: newProgram.status,
              createdByName: authUser.name,
              createdAt: new Date().toLocaleDateString(),
              dashboardUrl,
            },
          }).catch((err) => console.error("Failed to send program created email:", err));
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Program created successfully",
        program: newProgram,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create program" },
      { status: 500 }
    );
  }
}
