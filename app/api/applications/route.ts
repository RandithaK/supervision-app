import "reflect-metadata";
import { NextResponse } from "next/server";
import {
  getApplicationRepository,
  getAssignmentRepository,
  getUserRepository,
  getGroupRepository,
  getGroupMemberRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ApplicationStatus } from "@/lib/db/entities/SupervisionApplication";
import { GroupMemberStatus } from "@/lib/db/entities/SuperviseeGroupMember";
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

    let whereCondition = {};
    if (authUser.role === UserRole.SUPERVISEE) {
      whereCondition = { superviseeId: authUser.id };
    } else if (authUser.role === UserRole.SUPERVISOR) {
      whereCondition = { supervisorId: authUser.id };
    }

    const applications = await appRepo.find({
      where: whereCondition,
      relations: { supervisee: true, supervisor: true, group: { createdBy: true, members: { user: true } } },
      order: { createdAt: "DESC" },
    });

    const sanitized = applications.map((a) => ({
      id: a.id,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt,
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

// POST /api/applications (Supervisee applies for supervision)
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
    const { supervisorId, message, groupId } = body;

    if (!supervisorId) {
      return NextResponse.json(
        { success: false, error: "supervisorId is required." },
        { status: 400 }
      );
    }

    // Check if Supervisee is already assigned to a supervisor
    const assignmentRepo = await getAssignmentRepository();
    const activeAssignment = await assignmentRepo.findOneBy({ superviseeId: authUser.id });
    if (activeAssignment) {
      return NextResponse.json(
        {
          success: false,
          error: "You are already assigned to an accepted Supervisor and cannot apply for further supervision.",
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
    let groupMembers = [];
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
      
      // Check if any member already has an assignment
      for (const member of groupMembers) {
        const memberAssignment = await assignmentRepo.findOneBy({ superviseeId: member.userId });
        if (memberAssignment) {
          return NextResponse.json({ success: false, error: "One or more group members are already assigned to a supervisor." }, { status: 400 });
        }
      }

      const appRepo = await getApplicationRepository();
      const existingGroupApp = await appRepo.findOneBy({
        groupId,
        supervisorId: supervisorId,
        status: ApplicationStatus.PENDING,
      });

      if (existingGroupApp) {
        return NextResponse.json({ success: false, error: "Your group already has a pending application with this supervisor." }, { status: 409 });
      }
    } else {
      // Individual application check (if not applying as a group)
      const appRepo = await getApplicationRepository();
      const existing = await appRepo.findOneBy({
        superviseeId: authUser.id,
        supervisorId: supervisorId,
        status: ApplicationStatus.PENDING,
      });

      if (existing) {
        return NextResponse.json({ success: false, error: "You already have a pending application with this supervisor." }, { status: 409 });
      }
    }

    const appRepo = await getApplicationRepository();
    const newApp = appRepo.create({
      superviseeId: authUser.id,
      supervisorId: supervisorId,
      groupId: groupId || null,
      message: message || "",
      status: ApplicationStatus.PENDING,
    });

    await appRepo.save(newApp);

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`;

    // Dispatch non-blocking APPLICATION_SUBMITTED email + push to the Supervisee (confirmation)
    EmailService.sendEvent({
      eventType: "APPLICATION_SUBMITTED",
      to: authUser.email,
      payload: {
        userName: authUser.name,
        applicationId: newApp.id,
        submittedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${dashboardUrl}/supervisee`,
      }
    }).catch((err) => {
      console.error("Failed to send application submitted email:", err);
    });

    // Dispatch non-blocking APPLICATION_RECEIVED email + push to the Supervisor
    EmailService.sendEvent({
      eventType: "APPLICATION_RECEIVED",
      to: supervisor.email,
      payload: {
        supervisorName: supervisor.name,
        superviseeName: authUser.name,
        superviseeEmail: authUser.email,
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

    const userRepo = await getUserRepository();
    const supervisee = await userRepo.findOneBy({ id: application.superviseeId });
    const supervisor = await userRepo.findOneBy({ id: application.supervisorId });

    if (status === ApplicationStatus.ACCEPTED) {
      application.status = ApplicationStatus.ACCEPTED;
      await appRepo.save(application);

      const assignmentRepo = await getAssignmentRepository();
      let pendingAppsToWithdraw = [];

      if (application.groupId) {
        // GROUP ACCEPTANCE
        const groupMemberRepo = await getGroupMemberRepository();
        const members = await groupMemberRepo.find({ where: { groupId: application.groupId, status: GroupMemberStatus.ACTIVE }, relations: { user: true } });
        
        const groupRepo = await getGroupRepository();
        const group = await groupRepo.findOneBy({ id: application.groupId });
        
        for (const member of members) {
          let assignment = await assignmentRepo.findOneBy({
            supervisorId: application.supervisorId,
            superviseeId: member.userId,
          });

          if (!assignment) {
            assignment = assignmentRepo.create({
              supervisorId: application.supervisorId,
              superviseeId: member.userId,
            });
            await assignmentRepo.save(assignment);
          }

          // Find pending apps for this member to withdraw
          const memberPendingApps = await appRepo.find({
            where: {
              superviseeId: member.userId,
              status: ApplicationStatus.PENDING,
            },
          });
          pendingAppsToWithdraw.push(...memberPendingApps);
        }

        // Send group email
        if (supervisor && group) {
          const leader = members.find(m => m.userId === group.createdById);
          const leaderEmail = leader?.user.email;
          const otherEmails = members.filter(m => m.userId !== group.createdById).map(m => m.user.email);
          
          if (leaderEmail) {
            EmailService.sendEvent({
              eventType: "GROUP_APPLICATION_ACCEPTED",
              to: leaderEmail,
              cc: otherEmails.length > 0 ? otherEmails : undefined,
              payload: {
                userName: leader.user.name, // leader name
                supervisorName: supervisor.name,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
              }
            }).catch(console.error);
          }
        }

      } else {
        // INDIVIDUAL ACCEPTANCE
        let assignment = await assignmentRepo.findOneBy({
          supervisorId: application.supervisorId,
          superviseeId: application.superviseeId,
        });

        if (!assignment) {
          assignment = assignmentRepo.create({
            supervisorId: application.supervisorId,
            superviseeId: application.superviseeId,
          });
          await assignmentRepo.save(assignment);
        }

        const pendingApps = await appRepo.find({
          where: {
            superviseeId: application.superviseeId,
            status: ApplicationStatus.PENDING,
          },
        });
        pendingAppsToWithdraw.push(...pendingApps);
        
        if (supervisee) {
          EmailService.sendEvent({
            eventType: "APPLICATION_STATUS_UPDATED",
            to: supervisee.email,
            payload: {
              userName: supervisee.name,
              status: "APPROVED",
              badgeColor: "green",
              reviewerNotes: "Your application has been accepted.",
              updatedAt: new Date().toLocaleDateString(),
              actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
            }
          }).catch(console.error);
        }
      }

      // WITHDRAW OTHER PENDING APPLICATIONS
      let withdrawnCount = 0;
      for (const otherApp of pendingAppsToWithdraw) {
        if (otherApp.id !== application.id) {
          otherApp.status = ApplicationStatus.WITHDRAWN;
          await appRepo.save(otherApp);
          withdrawnCount++;
        }
      }

      // Supervisor notification (generic for both individual and group)
      if (supervisor) {
        EmailService.sendEvent({
          eventType: "ASSIGNMENT_CREATED",
          to: supervisor.email,
          payload: {
            recipientName: supervisor.name,
            supervisorName: supervisor.name,
            superviseeName: application.groupId ? `Group members` : (supervisee?.name || "Supervisee"),
            assignedDate: new Date().toLocaleDateString(),
            notes: application.groupId ? "Group supervision match." : "Standard supervision match.",
            dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
          }
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
            reviewerNotes: "Your application was not accepted at this time.",
            updatedAt: new Date().toLocaleDateString(),
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
          }
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
