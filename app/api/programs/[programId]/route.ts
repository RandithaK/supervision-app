import "reflect-metadata";
import { NextResponse } from "next/server";
import {
  getProgramRepository,
  getProgramSupervisorRepository,
  getProgramSuperviseeRepository,
  getAssignmentRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ProgramStatus } from "@/lib/db/entities/Program";
import { ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

interface RouteParams {
  params: Promise<{ programId: string }>;
}

// GET /api/programs/[programId] — Get program detail
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { programId } = await params;
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOne({
      where: { id: programId },
      relations: { createdBy: true },
    });

    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    // Supervisees cannot see DRAFT programs
    if (
      program.status === ProgramStatus.DRAFT &&
      authUser.role === UserRole.SUPERVISEE
    ) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    const programSupervisorRepo = await getProgramSupervisorRepository();
    const programSuperviseeRepo = await getProgramSuperviseeRepository();
    const assignmentRepo = await getAssignmentRepository();

    const [supervisors, supervisees, assignments] = await Promise.all([
      programSupervisorRepo.find({
        where: { programId },
        relations: { supervisor: true },
      }),
      programSuperviseeRepo.find({
        where: { programId },
        relations: { supervisee: true },
      }),
      assignmentRepo.find({
        where: { programId },
      }),
    ]);

    const assignedSuperviseeIds = new Set(assignments.map((a) => a.superviseeId));

    return NextResponse.json({
      success: true,
      program: {
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        createdBy: program.createdBy
          ? { id: program.createdBy.id, name: program.createdBy.name, email: program.createdBy.email }
          : null,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
        supervisors: supervisors.map((s) => ({
          id: s.id,
          status: s.status,
          joinedAt: s.joinedAt,
          supervisor: s.supervisor
            ? { id: s.supervisor.id, name: s.supervisor.name, email: s.supervisor.email }
            : null,
        })),
        supervisees: supervisees.map((s) => ({
          id: s.id,
          locked: assignedSuperviseeIds.has(s.superviseeId),
          joinedAt: s.joinedAt,
          supervisee: s.supervisee
            ? { id: s.supervisee.id, name: s.supervisee.name, email: s.supervisee.email }
            : null,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch program" },
      { status: 500 }
    );
  }
}

// PATCH /api/programs/[programId] — Update program (Admin/SuperAdmin only)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (
      !authUser ||
      (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN)
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const { programId } = await params;
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });

    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, status } = body;
    const oldStatus = program.status;
    let statusChanged = false;

    if (name !== undefined) program.name = name;
    if (description !== undefined) program.description = description;
    if (status !== undefined) {
      const validStatuses = Object.values(ProgramStatus) as string[];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }
      if (program.status !== (status as ProgramStatus)) {
        statusChanged = true;
        program.status = status as ProgramStatus;
      }
    }

    await programRepo.save(program);

    if (statusChanged) {
      // Notify enrolled supervisors of the status change
      const programSupervisorRepo = await getProgramSupervisorRepository();
      const supervisors = await programSupervisorRepo.find({
        where: { programId },
        relations: { supervisor: true },
      });

      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;
      for (const s of supervisors) {
        if (s.supervisor?.email) {
          EmailService.sendEvent({
            eventType: "PROGRAM_STATUS_CHANGED",
            to: s.supervisor.email,
            payload: {
              recipientName: s.supervisor.name,
              programName: program.name,
              newStatus: program.status,
              badgeColor: program.status === ProgramStatus.ACTIVE ? "green" : program.status === ProgramStatus.DRAFT ? "yellow" : "muted",
              statusExplanation: `The program status has transitioned from ${oldStatus} to ${program.status}.`,
              updatedAt: new Date().toLocaleDateString(),
              dashboardUrl: `${dashboardUrl}/supervisor`,
            },
          }).catch((err) => console.error("Failed to dispatch program status email:", err));
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Program updated.",
      program,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update program" },
      { status: 500 }
    );
  }
}

// DELETE /api/programs/[programId] — Delete program (SuperAdmin only)
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden. SuperAdmin access required." },
        { status: 403 }
      );
    }

    const { programId } = await params;
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });

    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    await programRepo.remove(program);

    return NextResponse.json({
      success: true,
      message: "Program deleted.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete program" },
      { status: 500 }
    );
  }
}
