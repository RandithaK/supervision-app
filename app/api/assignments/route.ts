import "reflect-metadata";
import { NextResponse } from "next/server";
import { In } from "typeorm";
import {
  getDataSource,
  getAssignmentRepository,
  getUserRepository,
  getProgramRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { SupervisionAssignment } from "@/lib/db/entities/SupervisionAssignment";
import { SupervisionApplication, ApplicationStatus } from "@/lib/db/entities/SupervisionApplication";
import { ProgramSupervisor, ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { ProgramSupervisee } from "@/lib/db/entities/ProgramSupervisee";
import { Program } from "@/lib/db/entities/Program";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

// GET /api/assignments — List assignments (filtered by role and query params)
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const assignmentRepo = await getAssignmentRepository();
    const url = new URL(request.url);
    const programId = url.searchParams.get("programId");
    const supervisorId = url.searchParams.get("supervisorId");
    const superviseeId = url.searchParams.get("superviseeId");
    const search = url.searchParams.get("search")?.toLowerCase();

    let whereCondition: any = {};
    if (authUser.role === UserRole.SUPERVISOR) {
      whereCondition = { supervisorId: authUser.id };
    } else if (authUser.role === UserRole.SUPERVISEE) {
      whereCondition = { superviseeId: authUser.id };
    } else {
      // Admins can filter by specific supervisor or supervisee
      if (supervisorId) whereCondition.supervisorId = supervisorId;
      if (superviseeId) whereCondition.superviseeId = superviseeId;
    }

    if (programId) {
      whereCondition.programId = programId;
    }

    const assignments = await assignmentRepo.find({
      where: whereCondition,
      relations: { supervisor: true, supervisee: true, program: true },
      order: { createdAt: "DESC" },
    });

    let filtered = assignments;
    if (search) {
      filtered = assignments.filter((a) => {
        const supName = a.supervisor?.name?.toLowerCase() || "";
        const supEmail = a.supervisor?.email?.toLowerCase() || "";
        const seName = a.supervisee?.name?.toLowerCase() || "";
        const seEmail = a.supervisee?.email?.toLowerCase() || "";
        const progName = a.program?.name?.toLowerCase() || "";
        return (
          supName.includes(search) ||
          supEmail.includes(search) ||
          seName.includes(search) ||
          seEmail.includes(search) ||
          progName.includes(search)
        );
      });
    }

    const sanitized = filtered.map((a) => ({
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

// POST /api/assignments — Create / Pair a Supervision Assignment manually (Admin only)
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

    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });
    if (!program) {
      return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
    }

    const assignmentRepo = await getAssignmentRepository();
    const existingForSupervisee = await assignmentRepo.findOneBy({ superviseeId, programId });

    if (existingForSupervisee) {
      if (existingForSupervisee.supervisorId === supervisorId) {
        return NextResponse.json(
          { success: true, message: "Supervision assignment already exists.", assignment: existingForSupervisee },
          { status: 200 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "Supervisee is already assigned to another supervisor in this program. Use reassign instead.",
        },
        { status: 400 }
      );
    }

    const dataSource = await getDataSource();
    let createdAssignment: SupervisionAssignment | null = null;

    await dataSource.transaction(async (manager) => {
      // Ensure supervisor is enrolled in program
      const existingProgSup = await manager.findOne(ProgramSupervisor, {
        where: { programId, supervisorId },
      });
      if (!existingProgSup) {
        const progSup = manager.create(ProgramSupervisor, {
          programId,
          supervisorId,
          status: ProgramParticipantStatus.ACTIVE,
        });
        await manager.save(ProgramSupervisor, progSup);
      } else if (existingProgSup.status === ProgramParticipantStatus.DISABLED) {
        existingProgSup.status = ProgramParticipantStatus.ACTIVE;
        await manager.save(ProgramSupervisor, existingProgSup);
      }

      // Ensure supervisee is enrolled in program
      const existingProgSe = await manager.findOne(ProgramSupervisee, {
        where: { programId, superviseeId },
      });
      if (!existingProgSe) {
        const progSe = manager.create(ProgramSupervisee, {
          programId,
          superviseeId,
        });
        await manager.save(ProgramSupervisee, progSe);
      }

      // Auto-withdraw pending applications in this program
      const pendingApps = await manager.find(SupervisionApplication, {
        where: {
          superviseeId,
          programId,
          status: ApplicationStatus.PENDING,
        },
      });
      if (pendingApps.length > 0) {
        await manager.update(
          SupervisionApplication,
          { id: In(pendingApps.map((a) => a.id)) },
          { status: ApplicationStatus.WITHDRAWN }
        );
      }

      // Create Assignment
      const newAssignment = manager.create(SupervisionAssignment, {
        supervisorId,
        superviseeId,
        programId,
      });
      createdAssignment = await manager.save(SupervisionAssignment, newAssignment);
    });

    // Send email notification to supervisor
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;
    EmailService.sendEvent({
      eventType: "ASSIGNMENT_CREATED",
      to: supervisor.email,
      payload: {
        recipientName: supervisor.name,
        supervisorName: supervisor.name,
        superviseeName: supervisee.name,
        programName: program.name,
        assignedDate: new Date().toLocaleDateString(),
        notes: "Manually assigned by Administrator.",
        dashboardUrl,
      },
    }).catch(console.error);

    return NextResponse.json(
      {
        success: true,
        message: "Supervision assignment created successfully",
        assignment: createdAssignment,
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

// PATCH /api/assignments — Reassign supervisor for an assignment (Admin only)
export async function PATCH(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN)) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { assignmentId, newSupervisorId } = body;

    if (!assignmentId || !newSupervisorId) {
      return NextResponse.json(
        { success: false, error: "assignmentId and newSupervisorId are required." },
        { status: 400 }
      );
    }

    const assignmentRepo = await getAssignmentRepository();
    const assignment = await assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { supervisor: true, supervisee: true, program: true },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found." }, { status: 404 });
    }

    const userRepo = await getUserRepository();
    const newSupervisor = await userRepo.findOneBy({ id: newSupervisorId, role: UserRole.SUPERVISOR });

    if (!newSupervisor) {
      return NextResponse.json(
        { success: false, error: "New supervisor not found or invalid." },
        { status: 400 }
      );
    }

    if (assignment.supervisorId === newSupervisorId) {
      return NextResponse.json(
        { success: false, error: "Supervisee is already assigned to this supervisor in this program." },
        { status: 400 }
      );
    }

    const oldSupervisor = assignment.supervisor;

    const dataSource = await getDataSource();
    await dataSource.transaction(async (manager) => {
      const currentAssignment = await manager.findOne(SupervisionAssignment, {
        where: { id: assignmentId },
      });
      if (!currentAssignment) {
        throw new Error("Assignment not found or was removed.");
      }

      // Ensure new supervisor is enrolled in the program
      if (currentAssignment.programId) {
        const existingProgSup = await manager.findOne(ProgramSupervisor, {
          where: { programId: currentAssignment.programId, supervisorId: newSupervisorId },
        });
        if (!existingProgSup) {
          const progSup = manager.create(ProgramSupervisor, {
            programId: currentAssignment.programId,
            supervisorId: newSupervisorId,
            status: ProgramParticipantStatus.ACTIVE,
          });
          await manager.save(ProgramSupervisor, progSup);
        } else if (existingProgSup.status === ProgramParticipantStatus.DISABLED) {
          existingProgSup.status = ProgramParticipantStatus.ACTIVE;
          await manager.save(ProgramSupervisor, existingProgSup);
        }
      }

      currentAssignment.supervisorId = newSupervisorId;
      await manager.save(SupervisionAssignment, currentAssignment);
      assignment.supervisorId = newSupervisorId;
    });

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;
    const reassignedDate = new Date().toLocaleDateString();

    // 1. Notify new supervisor
    if (newSupervisor.email) {
      EmailService.sendEvent({
        eventType: "ASSIGNMENT_REASSIGNED",
        to: newSupervisor.email,
        payload: {
          recipientName: newSupervisor.name,
          programName: assignment.program?.name || "Program",
          superviseeName: assignment.supervisee?.name || "Supervisee",
          newSupervisorName: newSupervisor.name,
          previousSupervisorName: oldSupervisor?.name || "Previous Supervisor",
          reassignedDate,
          dashboardUrl: `${dashboardUrl}/supervisor`,
        },
      }).catch((err) => console.error("Failed to notify new supervisor:", err));
    }

    // 2. Notify previous supervisor
    if (oldSupervisor?.email) {
      EmailService.sendEvent({
        eventType: "ASSIGNMENT_REASSIGNED",
        to: oldSupervisor.email,
        payload: {
          recipientName: oldSupervisor.name,
          programName: assignment.program?.name || "Program",
          superviseeName: assignment.supervisee?.name || "Supervisee",
          newSupervisorName: newSupervisor.name,
          previousSupervisorName: oldSupervisor.name,
          reassignedDate,
          dashboardUrl: `${dashboardUrl}/supervisor`,
        },
      }).catch((err) => console.error("Failed to notify old supervisor:", err));
    }

    // 3. Notify supervisee
    if (assignment.supervisee?.email) {
      EmailService.sendEvent({
        eventType: "ASSIGNMENT_REASSIGNED",
        to: assignment.supervisee.email,
        payload: {
          recipientName: assignment.supervisee.name,
          programName: assignment.program?.name || "Program",
          superviseeName: assignment.supervisee.name,
          newSupervisorName: newSupervisor.name,
          previousSupervisorName: oldSupervisor?.name || "Previous Supervisor",
          reassignedDate,
          dashboardUrl: `${dashboardUrl}/supervisee`,
        },
      }).catch((err) => console.error("Failed to notify supervisee:", err));
    }

    return NextResponse.json({
      success: true,
      message: "Supervisor reassigned successfully.",
      assignment,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reassign supervisor" },
      { status: 500 }
    );
  }
}

// DELETE /api/assignments — Revoke / Delete an assignment (Admin only)
export async function DELETE(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN)) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    let assignmentId = url.searchParams.get("assignmentId");

    if (!assignmentId) {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const body = await request.json();
          assignmentId = body.assignmentId;
        } catch {
          return NextResponse.json(
            { success: false, error: "Invalid JSON body provided." },
            { status: 400 }
          );
        }
      }
    }

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: "assignmentId query parameter or body field is required." },
        { status: 400 }
      );
    }

    const assignmentRepo = await getAssignmentRepository();
    const assignment = await assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: { supervisor: true, supervisee: true, program: true },
    });

    if (!assignment) {
      return NextResponse.json({ success: false, error: "Assignment not found." }, { status: 404 });
    }

    await assignmentRepo.remove(assignment);

    // Send revocation notices
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;
    const revokedDate = new Date().toLocaleDateString();

    if (assignment.supervisee?.email) {
      EmailService.sendEvent({
        eventType: "ASSIGNMENT_REVOKED",
        to: assignment.supervisee.email,
        payload: {
          recipientName: assignment.supervisee.name,
          programName: assignment.program?.name || "Program",
          superviseeName: assignment.supervisee.name,
          supervisorName: assignment.supervisor?.name || "Supervisor",
          revokedDate,
          notes: "Supervision match was revoked by an administrator. You may now apply to another supervisor in this program.",
          dashboardUrl: `${dashboardUrl}/supervisee`,
        },
      }).catch((err) => console.error("Failed to notify supervisee of revocation:", err));
    }

    if (assignment.supervisor?.email) {
      EmailService.sendEvent({
        eventType: "ASSIGNMENT_REVOKED",
        to: assignment.supervisor.email,
        payload: {
          recipientName: assignment.supervisor.name,
          programName: assignment.program?.name || "Program",
          superviseeName: assignment.supervisee?.name || "Supervisee",
          supervisorName: assignment.supervisor.name,
          revokedDate,
          notes: "Supervision match was revoked by an administrator.",
          dashboardUrl: `${dashboardUrl}/supervisor`,
        },
      }).catch((err) => console.error("Failed to notify supervisor of revocation:", err));
    }

    return NextResponse.json({
      success: true,
      message: "Supervision assignment revoked successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete assignment" },
      { status: 500 }
    );
  }
}
