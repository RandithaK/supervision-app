import "reflect-metadata";
import { NextResponse } from "next/server";
import { getAssignmentRepository, getUserRepository } from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { getAuthUser } from "@/lib/api-auth";

// GET /api/assignments
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const assignmentRepo = await getAssignmentRepository();
    const url = new URL(request.url);
    const programId = url.searchParams.get("programId");

    let whereCondition: any = {};
    if (authUser.role === UserRole.SUPERVISOR) {
      whereCondition = { supervisorId: authUser.id };
    } else if (authUser.role === UserRole.SUPERVISEE) {
      whereCondition = { superviseeId: authUser.id };
    }

    if (programId) {
      whereCondition.programId = programId;
    }

    const assignments = await assignmentRepo.find({
      where: whereCondition,
      relations: { supervisor: true, supervisee: true, program: true },
      order: { createdAt: "DESC" },
    });

    const sanitized = assignments.map((a) => ({
      id: a.id,
      programId: a.programId,
      program: a.program
        ? { id: a.program.id, name: a.program.name }
        : null,
      supervisor: a.supervisor
        ? { id: a.supervisor.id, name: a.supervisor.name, email: a.supervisor.email }
        : null,
      supervisee: a.supervisee
        ? { id: a.supervisee.id, name: a.supervisee.name, email: a.supervisee.email }
        : null,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ success: true, assignments: sanitized });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST /api/assignments (Admin/SuperAdmin only)
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN)) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supervisorId, superviseeId, programId } = body;

    if (!supervisorId || !superviseeId || !programId) {
      return NextResponse.json(
        { success: false, error: "supervisorId, superviseeId, and programId are required." },
        { status: 400 }
      );
    }

    const userRepo = await getUserRepository();
    const supervisor = await userRepo.findOneBy({ id: supervisorId, role: UserRole.SUPERVISOR });
    const supervisee = await userRepo.findOneBy({ id: superviseeId, role: UserRole.SUPERVISEE });

    if (!supervisor) {
      return NextResponse.json(
        { success: false, error: "Invalid supervisor ID or user is not a Supervisor." },
        { status: 400 }
      );
    }
    if (!supervisee) {
      return NextResponse.json(
        { success: false, error: "Invalid supervisee ID or user is not a Supervisee." },
        { status: 400 }
      );
    }

    const assignmentRepo = await getAssignmentRepository();
    let existing = await assignmentRepo.findOneBy({ supervisorId, superviseeId, programId });

    if (!existing) {
      existing = assignmentRepo.create({ supervisorId, superviseeId, programId });
      await assignmentRepo.save(existing);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Supervision assignment saved successfully",
        assignment: existing,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create assignment" },
      { status: 500 }
    );
  }
}
