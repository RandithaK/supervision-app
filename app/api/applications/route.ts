import "reflect-metadata";
import { NextResponse } from "next/server";
import { In } from "typeorm";
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
import { UserRole } from "@/lib/db/entities/User";
import { SupervisionApplication, ApplicationStatus } from "@/lib/db/entities/SupervisionApplication";
import { SupervisionAssignment } from "@/lib/db/entities/SupervisionAssignment";
import { ProgramSupervisee } from "@/lib/db/entities/ProgramSupervisee";
import { SuperviseeGroup } from "@/lib/db/entities/SuperviseeGroup";
import { SuperviseeGroupMember, GroupMemberStatus } from "@/lib/db/entities/SuperviseeGroupMember";
import { ProgramParticipantStatus } from "@/lib/db/entities/ProgramSupervisor";
import { ProgramStatus } from "@/lib/db/entities/Program";
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
      program: a.program
        ? { id: a.program.id, name: a.program.name }
        : null,
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
            createdBy: a.group.createdBy ? { id: a.group.createdBy.id, name: a.group.createdBy.name, email: a.group.createdBy.email } : null,
            members: a.group.members ? a.group.members.map(m => ({ id: m.id, user: { name: m.user.name, email: m.user.email } })) : []
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

// POST /api/applications (Supervisee applies for supervision within a program)
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.SUPERVISEE) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Only Supervisees can apply for supervision." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { supervisorId, message, groupId, programId } = body;

    if (!supervisorId) {
      return NextResponse.json(
        { success: false, error: "supervisorId is required." },
        { status: 400 }
      );
    }

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "programId is required." },
        { status: 400 }
      );
    }

    // Validate program exists and is ACTIVE
    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: programId });
    if (!program || program.status !== ProgramStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: "Program not found or not active." },
        { status: 400 }
      );
    }

    // Validate supervisee is a member of the program
    const programSuperviseeRepo = await getProgramSuperviseeRepository();
    const superviseeInProgram = await programSuperviseeRepo.findOneBy({
      programId,
      superviseeId: authUser.id,
    });
    if (!superviseeInProgram) {
      return NextResponse.json(
        { success: false, error: "You must join this program before applying." },
        { status: 400 }
      );
    }

    // Validate supervisor is ACTIVE in the program
    const programSupervisorRepo = await getProgramSupervisorRepository();
    const supervisorInProgram = await programSupervisorRepo.findOneBy({
      programId,
      supervisorId,
      status: ProgramParticipantStatus.ACTIVE,
    });
    if (!supervisorInProgram) {
      return NextResponse.json(
        { success: false, error: "This supervisor is not available in this program." },
        { status: 400 }
      );
    }

    // Check if Supervisee is already assigned to a supervisor IN THIS PROGRAM
    const assignmentRepo = await getAssignmentRepository();
    const activeAssignment = await assignmentRepo.findOneBy({
      superviseeId: authUser.id,
      programId,
    });
    if (activeAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "You are already assigned to a supervisor in this program.",
        },
        { status: 400 }
      );
    }

    // Check if supervisor exists
    const userRepo = await getUserRepository();
    const supervisor = await userRepo.findOneBy({ id: supervisorId, role: UserRole.SUPERVISOR });
    if (!supervisor) {
      return NextResponse.json(
        { success: false, error: "Target supervisor not found." },
        { status: 404 }
      );
    }

    // Group application logic
    let group = null;
    let groupMembers: any[] = [];
    if (groupId) {
      const groupRepo = await getGroupRepository();
      group = await groupRepo.findOne({ where: { id: groupId } });
      if (!group) {
        return NextResponse.json({ success: false, error: "Group not found." }, { status: 404 });
      }
      if (group.createdById !== authUser.id) {
        return NextResponse.json({ success: false, error: "Only the group leader can apply on behalf of the group." }, { status: 403 });
      }

      const groupMemberRepo = await getGroupMemberRepository();
      groupMembers = await groupMemberRepo.find({ where: { groupId, status: GroupMemberStatus.ACTIVE } });

      // Check if any member already has an assignment in this program
      for (const member of groupMembers) {
        const memberAssignment = await assignmentRepo.findOneBy({
          superviseeId: member.userId,
          programId,
        });
        if (memberAssignment) {
          return NextResponse.json({ success: false, error: "One or more group members are already assigned to a supervisor in this program." }, { status: 400 });
        }
      }

      const appRepo = await getApplicationRepository();
      const existingGroupApp = await appRepo.findOneBy({
        groupId,
        supervisorId: supervisorId,
        programId,
        status: ApplicationStatus.PENDING,
      });

      if (existingGroupApp) {
        return NextResponse.json({ success: false, error: "Your group already has a pending application with this supervisor in this program." }, { status: 409 });
      }
    } else {
      // Individual application check
      const appRepo = await getApplicationRepository();
      const existing = await appRepo.findOneBy({
        superviseeId: authUser.id,
        supervisorId: supervisorId,
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
      supervisorId: supervisorId,
      programId,
      groupId: groupId || null,
      message: message || "",
      status: ApplicationStatus.PENDING,
    });

    await appRepo.save(newApp);

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;

    // Dispatch non-blocking APPLICATION_SUBMITTED email to the Supervisee
    EmailService.sendEvent({
      eventType: "APPLICATION_SUBMITTED",
      to: authUser.email,
      payload: {
        userName: authUser.name,
        programName: program.name,
        applicationId: newApp.id,
        submittedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${dashboardUrl}/supervisee`,
      }
    }).catch((err) => {
      console.error("Failed to send application submitted email:", err);
    });

    // Dispatch non-blocking APPLICATION_RECEIVED email to the Supervisor
    EmailService.sendEvent({
      eventType: "APPLICATION_RECEIVED",
      to: supervisor.email,
      payload: {
        supervisorName: supervisor.name,
        superviseeName: authUser.name,
        superviseeEmail: authUser.email,
        programName: program.name,
        applicationMessage: message || "No message provided.",
        applicationId: newApp.id,
        submittedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${dashboardUrl}/supervisor`,
      }
    }).catch((err) => {
      console.error("Failed to send application received email to supervisor:", err);
    });

    return NextResponse.json(
      {
        success: true,
        message: "Application submitted successfully",
        application: newApp,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit application" },
      { status: 500 }
    );
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

    if (!applicationId || !status) {
      return NextResponse.json(
        { success: false, error: "applicationId and status are required." },
        { status: 400 }
      );
    }

    if (status !== ApplicationStatus.ACCEPTED && status !== ApplicationStatus.REJECTED) {
      return NextResponse.json(
        { success: false, error: "Status must be ACCEPTED or REJECTED." },
        { status: 400 }
      );
    }

    const appRepo = await getApplicationRepository();
    const application = await appRepo.findOneBy({ id: applicationId });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found." },
        { status: 404 }
      );
    }

    // IDOR Protection: Supervisors can only accept/reject their own applications
    if (
      authUser.role === UserRole.SUPERVISOR &&
      application.supervisorId !== authUser.id
    ) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only respond to applications sent to you." },
        { status: 403 }
      );
    }

    const programRepo = await getProgramRepository();
    const program = await programRepo.findOneBy({ id: application.programId });
    const programName = program?.name || "Supervision Program";

    const userRepo = await getUserRepository();
    const supervisee = await userRepo.findOneBy({ id: application.superviseeId });
    const supervisor = await userRepo.findOneBy({ id: application.supervisorId });

    if (status === ApplicationStatus.ACCEPTED) {
      const dataSource = await getDataSource();
      let withdrawnCount = 0;
      let groupMembers: any[] = [];
      let groupObj: any = null;

      await dataSource.transaction(async (manager) => {
        // Mark application accepted
        application.status = ApplicationStatus.ACCEPTED;
        await manager.save(SupervisionApplication, application);

        const memberIdsToProcess: string[] = [];

        if (application.groupId) {
          groupObj = await manager.findOne(SuperviseeGroup, { where: { id: application.groupId } });
          const members = await manager.find(SuperviseeGroupMember, {
            where: { groupId: application.groupId, status: GroupMemberStatus.ACTIVE },
            relations: { user: true },
          });
          groupMembers = members;
          memberIdsToProcess.push(...members.map((m) => m.userId));
        } else {
          memberIdsToProcess.push(application.superviseeId);
        }

        for (const memberId of memberIdsToProcess) {
          const existingAssign = await manager.findOne(SupervisionAssignment, {
            where: {
              supervisorId: application.supervisorId,
              superviseeId: memberId,
              programId: application.programId,
            },
          });

          if (!existingAssign) {
            const assignment = manager.create(SupervisionAssignment, {
              supervisorId: application.supervisorId,
              superviseeId: memberId,
              programId: application.programId,
            });
            await manager.save(SupervisionAssignment, assignment);
          }
        }

        // Auto-withdraw other pending applications in the same program
        if (memberIdsToProcess.length > 0) {
          const pendingApps = await manager.find(SupervisionApplication, {
            where: {
              superviseeId: In(memberIdsToProcess),
              programId: application.programId,
              status: ApplicationStatus.PENDING,
            },
          });

          const idsToWithdraw = pendingApps
            .map((a) => a.id)
            .filter((id) => id !== application.id);

          if (idsToWithdraw.length > 0) {
            await manager.update(
              SupervisionApplication,
              { id: In(idsToWithdraw) },
              { status: ApplicationStatus.WITHDRAWN }
            );
            withdrawnCount = idsToWithdraw.length;
          }
        }
      });

      // Non-blocking email dispatch
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
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
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
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
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
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
          },
        }).catch(console.error);
      }

      return NextResponse.json({
        success: true,
        message: "Application accepted.",
        application,
        withdrawnCount,
      });
    } else {
      // REJECTED
      application.status = ApplicationStatus.REJECTED;
      await appRepo.save(application);

      if (supervisee) {
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
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
          },
        }).catch(console.error);
      }

      return NextResponse.json({
        success: true,
        message: "Application rejected.",
        application,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update application" },
      { status: 500 }
    );
  }
}
