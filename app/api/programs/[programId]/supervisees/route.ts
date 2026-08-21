import "reflect-metadata";
import { NextResponse } from "next/server";
import {
  getProgramRepository,
  getProgramSuperviseeRepository,
  getAssignmentRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ProgramStatus } from "@/lib/db/entities/Program";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

interface RouteParams {
  params: Promise<{ programId: string }>;
}

// GET /api/programs/[programId]/supervisees — List supervisees in this program
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only supervisors and admins can list supervisees
    if (
      authUser.role !== UserRole.SUPERVISOR &&
      authUser.role !== UserRole.ADMIN &&
      authUser.role !== UserRole.SUPERADMIN
    ) {
      return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
    }

    const { programId } = await params;
    const programSuperviseeRepo = await getProgramSuperviseeRepository();
    const assignmentRepo = await getAssignmentRepository();

    const [memberships, activeAssignments] = await Promise.all([
      programSuperviseeRepo.find({
        where: { programId },
        relations: { supervisee: true },
      }),
      assignmentRepo.find({
        where: { programId },
      }),
    ]);

    const assignedSuperviseeIds = new Set(activeAssignments.map((a) => a.superviseeId));

    const supervisees = memberships.map((m) => ({
      id: m.id,
      locked: assignedSuperviseeIds.has(m.superviseeId),
      joinedAt: m.joinedAt,
      supervisee: m.supervisee
        ? { id: m.supervisee.id, name: m.supervisee.name, email: m.supervisee.email }
        : null,
    }));

    return NextResponse.json({ success: true, supervisees });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch program supervisees" },
      { status: 500 }
    );
  }
}

// POST /api/programs/[programId]/supervisees — Supervisee joins the program
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.SUPERVISEE) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Only supervisees can join programs." },
        { status: 403 }
      );
    }

    const { programId } = await params;
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });

    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    if (program.status !== ProgramStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: "Can only join active programs." },
        { status: 400 }
      );
    }

    const programSuperviseeRepo = await getProgramSuperviseeRepository();
    const existing = await programSuperviseeRepo.findOneBy({
      programId,
      superviseeId: authUser.id,
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "Already a member of this program.",
        membership: existing,
      });
    }

    const membership = programSuperviseeRepo.create({
      programId,
      superviseeId: authUser.id,
    });
    await programSuperviseeRepo.save(membership);

    // Send confirmation email to supervisee
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`;
    EmailService.sendEvent({
      eventType: "PROGRAM_SUPERVISEE_JOINED",
      to: authUser.email,
      payload: {
        superviseeName: authUser.name,
        programName: program.name,
        joinedAt: new Date().toLocaleDateString(),
        dashboardUrl,
      },
    }).catch((err) => console.error("Failed to send program supervisee joined email:", err));

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

// DELETE /api/programs/[programId]/supervisees — Supervisee leaves the program
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.SUPERVISEE) {
      return NextResponse.json(
        { success: false, error: "Forbidden." },
        { status: 403 }
      );
    }

    const { programId } = await params;
    const programSuperviseeRepo = await getProgramSuperviseeRepository();
    const membership = await programSuperviseeRepo.findOneBy({
      programId,
      superviseeId: authUser.id,
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Not a member of this program." },
        { status: 404 }
      );
    }

    // Cannot withdraw if locked (has active assignment in this program)
    const assignmentRepo = await getAssignmentRepository();
    const activeAssignment = await assignmentRepo.findOneBy({
      programId,
      superviseeId: authUser.id,
    });

    if (activeAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot leave program — you have an active supervision assignment in this program.",
        },
        { status: 400 }
      );
    }

    await programSuperviseeRepo.remove(membership);

    return NextResponse.json({ success: true, message: "Left program successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to leave program" },
      { status: 500 }
    );
  }
}
