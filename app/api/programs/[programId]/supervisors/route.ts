import "reflect-metadata";
import { NextResponse } from "next/server";
import {
  getProgramRepository,
  getProgramSupervisorRepository,
  getAssignmentRepository,
  getUserRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ProgramStatus } from "@/lib/db/entities/Program";
import { ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

interface RouteParams {
  params: Promise<{ programId: string }>;
}

// GET /api/programs/[programId]/supervisors — List supervisors in this program
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { programId } = await params;
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });

    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    const programSupervisorRepo = await getProgramSupervisorRepository();

    // For supervisees, only show ACTIVE supervisors. For admins/supervisors, show all.
    const whereCondition: any = { programId };
    if (authUser.role === UserRole.SUPERVISEE) {
      whereCondition.status = ProgramParticipantStatus.ACTIVE;
    }

    const memberships = await programSupervisorRepo.find({
      where: whereCondition,
      relations: { supervisor: true },
    });

    const supervisors = memberships.map((m) => ({
      id: m.id,
      status: m.status,
      joinedAt: m.joinedAt,
      supervisor: m.supervisor
        ? {
            id: m.supervisor.id,
            name: m.supervisor.name,
            email: m.supervisor.email,
            areasOfInterest: Array.isArray(m.supervisor.areasOfInterest)
              ? m.supervisor.areasOfInterest
              : typeof m.supervisor.areasOfInterest === "string"
              ? (m.supervisor.areasOfInterest as string).split(",").map((t) => t.trim()).filter(Boolean)
              : [],
          }
        : null,
    }));

    return NextResponse.json({ success: true, supervisors });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch program supervisors" },
      { status: 500 }
    );
  }
}

// POST /api/programs/[programId]/supervisors — Supervisor joins the program
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { programId } = await params;
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });

    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    if (program.status === ProgramStatus.ARCHIVED) {
      return NextResponse.json(
        { success: false, error: "Cannot join an archived program." },
        { status: 400 }
      );
    }

    // Determine which supervisor to add
    let supervisorId: string;
    if (authUser.role === UserRole.SUPERVISOR) {
      supervisorId = authUser.id;
    } else if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPERADMIN) {
      const body = await request.json();
      if (!body.supervisorId) {
        return NextResponse.json(
          { success: false, error: "supervisorId is required when admin adds a supervisor." },
          { status: 400 }
        );
      }
      supervisorId = body.supervisorId;
    } else {
      return NextResponse.json(
        { success: false, error: "Forbidden. Only supervisors can join programs." },
        { status: 403 }
      );
    }

    const programSupervisorRepo = await getProgramSupervisorRepository();
    const existing = await programSupervisorRepo.findOneBy({ programId, supervisorId });

    if (existing) {
      // Re-enable if was disabled
      if (existing.status === ProgramParticipantStatus.DISABLED) {
        existing.status = ProgramParticipantStatus.ACTIVE;
        await programSupervisorRepo.save(existing);
        return NextResponse.json({ success: true, message: "Re-enabled in program.", membership: existing });
      }
      return NextResponse.json(
        { success: false, error: "Already a member of this program." },
        { status: 409 }
      );
    }

    const membership = programSupervisorRepo.create({
      programId,
      supervisorId,
      status: ProgramParticipantStatus.ACTIVE,
    });
    await programSupervisorRepo.save(membership);

    // Send confirmation email to supervisor
    const userRepo = await getUserRepository();
    const supervisorUser = await userRepo.findOneBy({ id: supervisorId });
    if (supervisorUser) {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisor`;
      EmailService.sendEvent({
        eventType: "PROGRAM_SUPERVISOR_JOINED",
        to: supervisorUser.email,
        payload: {
          supervisorName: supervisorUser.name,
          programName: program.name,
          joinedAt: new Date().toLocaleDateString(),
          dashboardUrl,
        },
      }).catch((err) => console.error("Failed to send program supervisor joined email:", err));
    }

    return NextResponse.json(
      { success: true, message: "Joined program successfully.", membership },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to join program" },
      { status: 500 }
    );
  }
}

// PATCH /api/programs/[programId]/supervisors — Enable/disable supervisor in program
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { programId } = await params;
    const body = await request.json();
    const { status, supervisorId } = body;

    if (!status || !Object.values(ProgramParticipantStatus).includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status must be ACTIVE or DISABLED." },
        { status: 400 }
      );
    }

    // Determine target supervisor
    let targetSupervisorId: string;
    if (authUser.role === UserRole.SUPERVISOR) {
      targetSupervisorId = authUser.id;
    } else if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPERADMIN) {
      if (!supervisorId) {
        return NextResponse.json(
          { success: false, error: "supervisorId required for admin action." },
          { status: 400 }
        );
      }
      targetSupervisorId = supervisorId;
    } else {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });
    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    const programSupervisorRepo = await getProgramSupervisorRepository();
    const membership = await programSupervisorRepo.findOneBy({
      programId,
      supervisorId: targetSupervisorId,
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Supervisor is not a member of this program." },
        { status: 404 }
      );
    }

    membership.status = status;
    await programSupervisorRepo.save(membership);

    // Send confirmation email
    const userRepo = await getUserRepository();
    const supervisorUser = await userRepo.findOneBy({ id: targetSupervisorId });
    if (supervisorUser?.email) {
      const isActive = status === ProgramParticipantStatus.ACTIVE;
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisor`;
      EmailService.sendEvent({
        eventType: "PROGRAM_SUPERVISOR_STATUS_CHANGED",
        to: supervisorUser.email,
        payload: {
          supervisorName: supervisorUser.name,
          programName: program.name,
          statusText: isActive ? "Active" : "Disabled",
          badgeColor: isActive ? "green" : "yellow",
          statusExplanation: isActive
            ? "You are now active and visible to supervisees in this program."
            : "You are currently disabled in this program. Supervisees cannot send you new applications, but existing assignments remain active.",
          updatedAt: new Date().toLocaleDateString(),
          dashboardUrl,
        },
      }).catch((err) => console.error("Failed to send supervisor status change email:", err));
    }

    return NextResponse.json({
      success: true,
      message: `Supervisor ${status === ProgramParticipantStatus.ACTIVE ? "enabled" : "disabled"} in program.`,
      membership,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update supervisor status" },
      { status: 500 }
    );
  }
}

// DELETE /api/programs/[programId]/supervisors — Supervisor leaves the program
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { programId } = await params;

    let targetSupervisorId: string;
    if (authUser.role === UserRole.SUPERVISOR) {
      targetSupervisorId = authUser.id;
    } else if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPERADMIN) {
      const url = new URL(request.url);
      const svId = url.searchParams.get("supervisorId");
      if (!svId) {
        return NextResponse.json(
          { success: false, error: "supervisorId query param required for admin removal." },
          { status: 400 }
        );
      }
      targetSupervisorId = svId;
    } else {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    // Check for active assignments in this program
    const assignmentRepo = await getAssignmentRepository();
    const activeAssignments = await assignmentRepo.find({
      where: { supervisorId: targetSupervisorId, programId },
    });

    if (activeAssignments.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot leave program — you have active assignments. Disable yourself instead.",
        },
        { status: 400 }
      );
    }

    const programSupervisorRepo = await getProgramSupervisorRepository();
    const membership = await programSupervisorRepo.findOneBy({
      programId,
      supervisorId: targetSupervisorId,
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Not a member of this program." },
        { status: 404 }
      );
    }

    await programSupervisorRepo.remove(membership);

    return NextResponse.json({ success: true, message: "Left program successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to leave program" },
      { status: 500 }
    );
  }
}
