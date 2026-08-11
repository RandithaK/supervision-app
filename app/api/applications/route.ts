import "reflect-metadata";
import { NextResponse } from "next/server";
import {
  getApplicationRepository,
  getAssignmentRepository,
  getUserRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ApplicationStatus } from "@/lib/db/entities/SupervisionApplication";
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
      relations: { supervisee: true, supervisor: true },
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
    const { supervisorId, message } = body;

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

    const appRepo = await getApplicationRepository();

    // Check if already has a PENDING application to this supervisor
    const existing = await appRepo.findOneBy({
      superviseeId: authUser.id,
      supervisorId: supervisorId,
      status: ApplicationStatus.PENDING,
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "You already have a pending application with this supervisor." },
        { status: 409 }
      );
    }

    const newApp = appRepo.create({
      superviseeId: authUser.id,
      supervisorId: supervisorId,
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

      // 1. Create SupervisionAssignment
      const assignmentRepo = await getAssignmentRepository();
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

      // 2. AUTOMATIC WITHDRAWAL: Find all OTHER pending applications by this supervisee and set status to WITHDRAWN
      const pendingApps = await appRepo.find({
        where: {
          superviseeId: application.superviseeId,
          status: ApplicationStatus.PENDING,
        },
      });

      for (const otherApp of pendingApps) {
        if (otherApp.id !== application.id) {
          otherApp.status = ApplicationStatus.WITHDRAWN;
          await appRepo.save(otherApp);
        }
      }

      // Dispatch non-blocking APPLICATION_STATUS_UPDATED & ASSIGNMENT_CREATED emails
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

        if (supervisor) {
          EmailService.sendEvent({
            eventType: "ASSIGNMENT_CREATED",
            to: supervisee.email,
            payload: {
              recipientName: supervisee.name,
              supervisorName: supervisor.name,
              superviseeName: supervisee.name,
              assignedDate: new Date().toLocaleDateString(),
              notes: "Standard supervision match.",
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
            }
          }).catch(console.error);

          EmailService.sendEvent({
            eventType: "ASSIGNMENT_CREATED",
            to: supervisor.email,
            payload: {
              recipientName: supervisor.name,
              supervisorName: supervisor.name,
              superviseeName: supervisee.name,
              assignedDate: new Date().toLocaleDateString(),
              notes: "Standard supervision match.",
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
            }
          }).catch(console.error);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Application accepted. Supervisor assigned to supervisee and all other pending applications withdrawn.",
        application,
        assignment,
        withdrawnCount: pendingApps.length - 1 > 0 ? pendingApps.length - 1 : 0,
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
