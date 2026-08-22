import "reflect-metadata";
import { NextResponse } from "next/server";
import { In, type EntityManager } from "typeorm";
import {
  getDataSource,
  getApplicationRepository,
  getAssignmentRepository,
  getUserRepository,
  getGroupRepository,
  getGroupMemberRepository,
  getProgramRepository,
  getProgramSupervisorRepository,
  getProgramSuperviseeRepository,
} from "@/lib/db/data-source";
import { UserRole, type User } from "@/lib/db/entities/User";
import { SupervisionApplication, ApplicationStatus } from "@/lib/db/entities/SupervisionApplication";
import { SupervisionAssignment } from "@/lib/db/entities/SupervisionAssignment";
import { ProgramSupervisee } from "@/lib/db/entities/ProgramSupervisee";
import { SuperviseeGroup } from "@/lib/db/entities/SuperviseeGroup";
import { SuperviseeGroupMember, GroupMemberStatus } from "@/lib/db/entities/SuperviseeGroupMember";
import { ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { ProgramStatus, type Program } from "@/lib/db/entities/Program";
import { getAuthUser } from "@/lib/api-auth";
import { EmailService } from "@/lib/email";

// GET /api/applications
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const appRepo = await getApplicationRepository();
    const url = new URL(request.url);
    const programId = url.searchParams.get("programId");

    let whereCondition: any = {};
    if (authUser.role === UserRole.SUPERVISEE) {
      whereCondition = { superviseeId: authUser.id };
    } else if (authUser.role === UserRole.SUPERVISOR) {
      whereCondition = { supervisorId: authUser.id };
    }

    if (programId) {
      whereCondition.programId = programId;
    }

    const applications = await appRepo.find({
      where: whereCondition,
      relations: { supervisee: true, supervisor: true, group: { createdBy: true, members: { user: true } }, program: true },
      order: { createdAt: "DESC" },
    });

    const sanitized = applications.map((a) => ({
      id: a.id,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt,
      programId: a.programId,
      program: a.program ? { id: a.program.id, name: a.program.name } : null,
      supervisee: a.supervisee
        ? { id: a.supervisee.id, name: a.supervisee.name, email: a.supervisee.email }
        : null,
      supervisor: a.supervisor
        ? {
            id: a.supervisor.id,
            name: a.supervisor.name,
            email: a.supervisor.email,
            areasOfInterest: a.supervisor.areasOfInterest,
          }
        : null,
      group: a.group
        ? {
            id: a.group.id,
            name: a.group.name,
            createdBy: a.group.createdBy
              ? { id: a.group.createdBy.id, name: a.group.createdBy.name, email: a.group.createdBy.email }
              : null,
            members: a.group.members
              ? a.group.members.map((m) => ({ id: m.id, user: { name: m.user.name, email: m.user.email } }))
              : [],
          }
        : null,
    }));

    return NextResponse.json({ success: true, applications: sanitized });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

async function validateProgramAndParticipants(
  programId: string,
  superviseeId: string,
  supervisorId: string
): Promise<{ program?: Program; error?: { message: string; status: number } }> {
  const programRepo = await getProgramRepository();
  const program = await programRepo.findOneBy({ id: programId });
  if (program?.status !== ProgramStatus.ACTIVE) {
    return { error: { message: "Program not found or not active.", status: 400 } };
  }

  const programSuperviseeRepo = await getProgramSuperviseeRepository();
  const superviseeInProgram = await programSuperviseeRepo.findOneBy({ programId, superviseeId });
  if (!superviseeInProgram) {
    return { error: { message: "You must join this program before applying.", status: 400 } };
  }

  const programSupervisorRepo = await getProgramSupervisorRepository();
  const supervisorInProgram = await programSupervisorRepo.findOneBy({
    programId,
    supervisorId,
    status: ProgramParticipantStatus.ACTIVE,
  });
  if (!supervisorInProgram) {
    return { error: { message: "This supervisor is not available in this program.", status: 400 } };
  }

  const assignmentRepo = await getAssignmentRepository();
  const activeAssignment = await assignmentRepo.findOneBy({ superviseeId, programId });
  if (activeAssignment) {
    return { error: { message: "You are already assigned to a supervisor in this program.", status: 400 } };
  }

  return { program };
}

async function validateGroupApplication(
  groupId: string,
  superviseeId: string,
  supervisorId: string,
  programId: string
): Promise<{ error?: { message: string; status: number } }> {
  const groupRepo = await getGroupRepository();
  const group = await groupRepo.findOne({ where: { id: groupId } });
  if (!group) {
    return { error: { message: "Group not found.", status: 404 } };
  }
  if (group.createdById !== superviseeId) {
    return { error: { message: "Only the group leader can apply on behalf of the group.", status: 403 } };
  }

  const groupMemberRepo = await getGroupMemberRepository();
  const groupMembers = await groupMemberRepo.find({ where: { groupId, status: GroupMemberStatus.ACTIVE } });
  const assignmentRepo = await getAssignmentRepository();

  for (const member of groupMembers) {
    const memberAssignment = await assignmentRepo.findOneBy({ superviseeId: member.userId, programId });
    if (memberAssignment) {
      return { error: { message: "One or more group members are already assigned to a supervisor in this program.", status: 400 } };
    }
  }

  const appRepo = await getApplicationRepository();
  const existingGroupApp = await appRepo.findOneBy({
    groupId,
    supervisorId,
    programId,
    status: ApplicationStatus.PENDING,
  });
  if (existingGroupApp) {
    return { error: { message: "Your group already has a pending application with this supervisor in this program.", status: 409 } };
  }

  return {};
}

function sendApplicationSubmittedEmails(
  authUser: { name: string; email: string },
  supervisor: User,
  programName: string,
  newAppId: string,
  message: string
) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"}`;

  EmailService.sendEvent({
    eventType: "APPLICATION_SUBMITTED",
    to: authUser.email,
    payload: {
      userName: authUser.name,
      programName,
      applicationId: newAppId,
      submittedAt: new Date().toLocaleDateString(),
      dashboardUrl: `${dashboardUrl}/supervisee`,
    },
  }).catch((err) => console.error("Failed to send application submitted email:", err));

  EmailService.sendEvent({
    eventType: "APPLICATION_RECEIVED",
    to: supervisor.email,
    payload: {
      supervisorName: supervisor.name,
      superviseeName: authUser.name,
      superviseeEmail: authUser.email,
      programName,
      applicationMessage: message || "No message provided.",
      applicationId: newAppId,
      submittedAt: new Date().toLocaleDateString(),
      dashboardUrl: `${dashboardUrl}/supervisor`,
    },
  }).catch((err) => console.error("Failed to send application received email to supervisor:", err));
}

// POST /api/applications (Supervisee applies for supervision within a program)
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (authUser?.role !== UserRole.SUPERVISEE) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Only Supervisees can apply for supervision." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supervisorId, message, groupId, programId } = body;

    if (!supervisorId || !programId) {
      return NextResponse.json(
        { success: false, error: "supervisorId and programId are required." },
        { status: 400 }
      );
    }

    const { program, error: progErr } = await validateProgramAndParticipants(
      programId,
      authUser.id,
      supervisorId
    );
    if (progErr || !program) {
      return NextResponse.json({ success: false, error: progErr?.message }, { status: progErr?.status || 400 });
    }

    const userRepo = await getUserRepository();
    const supervisor = await userRepo.findOneBy({ id: supervisorId, role: UserRole.SUPERVISOR });
    if (!supervisor) {
      return NextResponse.json({ success: false, error: "Target supervisor not found." }, { status: 404 });
    }

    if (groupId) {
      const { error: groupErr } = await validateGroupApplication(groupId, authUser.id, supervisorId, programId);
      if (groupErr) {
        return NextResponse.json({ success: false, error: groupErr.message }, { status: groupErr.status });
      }
    } else {
      const appRepo = await getApplicationRepository();
      const existing = await appRepo.findOneBy({
        superviseeId: authUser.id,
        supervisorId,
        programId,
        status: ApplicationStatus.PENDING,
      });
      if (existing) {
        return NextResponse.json({ success: false, error: "You already have a pending application with this supervisor in this program." }, { status: 409 });
      }
    }

    const appRepo = await getApplicationRepository();
    const newApp = appRepo.create({
      superviseeId: authUser.id,
      supervisorId,
      programId,
      groupId: groupId || null,
      message: message || "",
      status: ApplicationStatus.PENDING,
    });
    await appRepo.save(newApp);

    sendApplicationSubmittedEmails(authUser, supervisor, program.name, newApp.id, message || "");

    return NextResponse.json(
      { success: true, message: "Application submitted successfully", application: newApp },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit application" },
      { status: 500 }
    );
  }
}

async function processApplicationAssignments(
  manager: EntityManager,
  application: SupervisionApplication
): Promise<{ memberIds: string[]; groupObj: SuperviseeGroup | null; groupMembers: SuperviseeGroupMember[] }> {
  const memberIds: string[] = [];
  let groupObj: SuperviseeGroup | null = null;
  let groupMembers: SuperviseeGroupMember[] = [];

  if (application.groupId) {
    groupObj = await manager.findOne(SuperviseeGroup, { where: { id: application.groupId } });
    groupMembers = await manager.find(SuperviseeGroupMember, {
      where: { groupId: application.groupId, status: GroupMemberStatus.ACTIVE },
      relations: { user: true },
    });
    memberIds.push(...groupMembers.map((m) => m.userId));
  } else {
    memberIds.push(application.superviseeId);
  }

  for (const memberId of memberIds) {
    if (application.programId) {
      const existingMembership = await manager.findOne(ProgramSupervisee, {
        where: { programId: application.programId, superviseeId: memberId },
      });
      if (!existingMembership) {
        const membership = manager.create(ProgramSupervisee, {
          programId: application.programId,
          superviseeId: memberId,
        });
        await manager.save(ProgramSupervisee, membership);
      }
    }

    const assignWhere: any = { supervisorId: application.supervisorId, superviseeId: memberId };
    if (application.programId) {
      assignWhere.programId = application.programId;
    }

    const existingAssign = await manager.findOne(SupervisionAssignment, { where: assignWhere });
    if (!existingAssign) {
      const assignment = manager.create(SupervisionAssignment, {
        supervisorId: application.supervisorId,
        superviseeId: memberId,
        programId: application.programId || null,
      });
      await manager.save(SupervisionAssignment, assignment);
    }
  }

  return { memberIds, groupObj, groupMembers };
}

async function withdrawPendingApplications(
  manager: EntityManager,
  application: SupervisionApplication,
  memberIds: string[]
): Promise<number> {
  if (memberIds.length === 0) return 0;

  const pendingWhere: any = {
    superviseeId: In(memberIds),
    status: ApplicationStatus.PENDING,
  };
  if (application.programId) {
    pendingWhere.programId = application.programId;
  }

  const pendingApps = await manager.find(SupervisionApplication, { where: pendingWhere });
  const idsToWithdraw = pendingApps.map((a) => a.id).filter((id) => id !== application.id);

  if (idsToWithdraw.length > 0) {
    await manager.update(SupervisionApplication, { id: In(idsToWithdraw) }, { status: ApplicationStatus.WITHDRAWN });
  }

  return idsToWithdraw.length;
}

function sendAcceptanceEmails(
  application: SupervisionApplication,
  supervisor: User | null,
  supervisee: User | null,
  groupObj: SuperviseeGroup | null,
  groupMembers: SuperviseeGroupMember[],
  programName: string
) {
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"}`;

  if (application.groupId && supervisor && groupObj) {
    const leader = groupMembers.find((m) => m.userId === groupObj.createdById);
    const leaderEmail = leader?.user?.email;
    const otherEmails = groupMembers
      .filter((m) => m.userId !== groupObj.createdById)
      .map((m) => m.user?.email)
      .filter(Boolean);

    if (leaderEmail) {
      EmailService.sendEvent({
        eventType: "GROUP_APPLICATION_ACCEPTED",
        to: leaderEmail,
        cc: otherEmails.length > 0 ? otherEmails : undefined,
        payload: {
          userName: leader.user.name,
          supervisorName: supervisor.name,
          programName,
          dashboardUrl: `${dashboardUrl}/supervisee`,
        },
      }).catch(console.error);
    }
  } else if (!application.groupId && supervisee) {
    EmailService.sendEvent({
      eventType: "APPLICATION_STATUS_UPDATED",
      to: supervisee.email,
      payload: {
        userName: supervisee.name,
        status: "APPROVED",
        badgeColor: "green",
        programName,
        reviewerNotes: "Your application has been accepted.",
        updatedAt: new Date().toLocaleDateString(),
        actionUrl: `${dashboardUrl}/supervisee`,
      },
    }).catch(console.error);
  }

  if (supervisor) {
    EmailService.sendEvent({
      eventType: "ASSIGNMENT_CREATED",
      to: supervisor.email,
      payload: {
        recipientName: supervisor.name,
        supervisorName: supervisor.name,
        superviseeName: application.groupId ? "Group members" : (supervisee?.name || "Supervisee"),
        programName,
        assignedDate: new Date().toLocaleDateString(),
        notes: application.groupId ? "Group supervision match." : "Standard supervision match.",
        dashboardUrl,
      },
    }).catch(console.error);
  }
}

// PATCH /api/applications (Supervisor accepts or rejects application)
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
    const { applicationId, status } = body;

    if (!applicationId || !status || (status !== ApplicationStatus.ACCEPTED && status !== ApplicationStatus.REJECTED)) {
      return NextResponse.json(
        { success: false, error: "Valid applicationId and status (ACCEPTED or REJECTED) are required." },
        { status: 400 }
      );
    }

    const appRepo = await getApplicationRepository();
    const application = await appRepo.findOneBy({ id: applicationId });
    if (!application) {
      return NextResponse.json({ success: false, error: "Application not found." }, { status: 404 });
    }

    if (authUser.role === UserRole.SUPERVISOR && application.supervisorId !== authUser.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only respond to applications sent to you." },
        { status: 403 }
      );
    }

    let programName = "Supervision Program";
    if (application.programId) {
      const programRepo = await getProgramRepository();
      const program = await programRepo.findOneBy({ id: application.programId });
      if (program) programName = program.name;
    }

    const userRepo = await getUserRepository();
    const supervisee = await userRepo.findOneBy({ id: application.superviseeId });
    const supervisor = await userRepo.findOneBy({ id: application.supervisorId });

    if (status === ApplicationStatus.ACCEPTED) {
      const dataSource = await getDataSource();
      let withdrawnCount = 0;

      await dataSource.transaction(async (manager) => {
        application.status = ApplicationStatus.ACCEPTED;
        await manager.save(SupervisionApplication, application);

        const { memberIds, groupObj, groupMembers } = await processApplicationAssignments(manager, application);
        withdrawnCount = await withdrawPendingApplications(manager, application, memberIds);

        sendAcceptanceEmails(application, supervisor, supervisee, groupObj, groupMembers, programName);
      });

      return NextResponse.json({
        success: true,
        message: "Application accepted.",
        application,
        withdrawnCount,
      });
    }

    // REJECTED
    application.status = ApplicationStatus.REJECTED;
    await appRepo.save(application);

    if (supervisee) {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"}`;
      EmailService.sendEvent({
        eventType: "APPLICATION_STATUS_UPDATED",
        to: supervisee.email,
        payload: {
          userName: supervisee.name,
          status: "REJECTED",
          badgeColor: "destructive",
          programName,
          reviewerNotes: "Your application was not accepted at this time.",
          updatedAt: new Date().toLocaleDateString(),
          actionUrl: `${dashboardUrl}/supervisee`,
        },
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, message: "Application rejected.", application });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update application" },
      { status: 500 }
    );
  }
}
