import "reflect-metadata";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { UserRole } from "@/lib/db/entities/User";
import {
  EmailService,
  verifySmtpConnection,
  getSmtpConfig,
  isSmtpConfigured,
  TemplateEngine,
  type KeyEventType,
} from "@/lib/email";

// GET /api/admin/email/test
// Diagnostic endpoint to check SMTP connection status & list key events
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const config = await getSmtpConfig();
    const isConfigured = isSmtpConfigured();
    const connectionResult = await verifySmtpConnection();

    const supportedEvents: KeyEventType[] = [
      "WELCOME_USER",
      "APPLICATION_SUBMITTED",
      "APPLICATION_RECEIVED",
      "APPLICATION_STATUS_UPDATED",
      "ASSIGNMENT_CREATED",
      "PASSWORD_RESET",
      "SYSTEM_ALERT",
    ];

    return NextResponse.json({
      success: true,
      smtp: {
        isConfigured,
        config: {
          host: config.host || "(Not set)",
          port: config.port,
          secure: config.secure,
          fromName: config.fromName,
          fromEmail: config.fromEmail,
          userConfigured: Boolean(config.user),
        },
        connection: connectionResult,
      },
      supportedEvents,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to test SMTP connection" },
      { status: 500 }
    );
  }
}

// POST /api/admin/email/test
// Send a test email or render an email preview for a specific key event
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action = "send", eventType = "WELCOME_USER", recipientEmail, customPayload = {} } = body;

    const targetEmail = recipientEmail || authUser.email;

    // Default payloads for key event previews/tests
    const samplePayloads: Record<KeyEventType, Record<string, any>> = {
      WELCOME_USER: {
        userName: authUser.name || "John Doe",
        userEmail: targetEmail,
        userRole: authUser.role || "SUPERVISEE",
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`,
      },
      APPLICATION_SUBMITTED: {
        userName: authUser.name || "Jane Smith",
        applicationId: "APP-2026-8891",
        submittedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
      },
      APPLICATION_RECEIVED: {
        supervisorName: authUser.name || "Dr. Alice Morgan",
        superviseeName: "Jane Smith",
        superviseeEmail: "jane.smith@example.com",
        applicationMessage: "I am very interested in your research area.",
        applicationId: "APP-2026-8892",
        submittedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisor`,
      },
      APPLICATION_STATUS_UPDATED: {
        userName: authUser.name || "Jane Smith",
        status: "APPROVED",
        reviewerNotes: "Congratulations! Your supervision application was accepted.",
        updatedAt: new Date().toLocaleDateString(),
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
      },
      ASSIGNMENT_CREATED: {
        recipientName: authUser.name || "Recipient",
        supervisorName: "Dr. Alice Morgan",
        superviseeName: "Bob Johnson",
        assignedDate: new Date().toLocaleDateString(),
        notes: "Bi-weekly supervision sessions scheduled.",
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
      },
      PASSWORD_RESET: {
        userName: authUser.name || "John Doe",
        resetUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=sample_token_123`,
        expiresIn: "60 minutes",
      },
      SYSTEM_ALERT: {
        alertTitle: "SMTP Module Verified",
        alertMessage: "The email sender and template engine was successfully verified.",
        severity: "INFO",
        timestamp: new Date().toISOString(),
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin`,
      },
      OTP_VERIFICATION: {
        otp: "123456",
      },
      GROUP_INVITATION: {
        userName: "Test User",
        groupName: "Test Group",
        leaderName: "Test Leader",
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
      },
      GROUP_APPLICATION_ACCEPTED: {
        userName: "Test Leader",
        supervisorName: "Test Supervisor",
        programName: "Sample CBT Program",
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
      },
      PROGRAM_CREATED: {
        recipientName: authUser.name || "Supervisor",
        programName: "CBT Supervision 2026",
        programDescription: "Supervision program for Cognitive Behavioral Therapy trainees.",
        programStatus: "ACTIVE",
        createdByName: "Admin",
        createdAt: new Date().toLocaleDateString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisor`,
      },
      PROGRAM_SUPERVISOR_JOINED: {
        supervisorName: authUser.name || "Dr. Alice Morgan",
        programName: "CBT Supervision 2026",
        joinedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisor`,
      },
      PROGRAM_SUPERVISEE_JOINED: {
        superviseeName: authUser.name || "Jane Smith",
        programName: "CBT Supervision 2026",
        joinedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
      },
      PROGRAM_STATUS_CHANGED: {
        recipientName: authUser.name || "User",
        programName: "CBT Supervision 2026",
        newStatus: "ACTIVE",
        badgeColor: "green",
        statusExplanation: "The program status has transitioned from DRAFT to ACTIVE.",
        updatedAt: new Date().toLocaleDateString(),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
      },
    };

    const finalPayload = {
      ...(samplePayloads[eventType as KeyEventType] || {}),
      ...customPayload,
    };

    if (action === "preview") {
      const rendered = TemplateEngine.renderKeyEvent(eventType as KeyEventType, finalPayload);
      return NextResponse.json({
        success: true,
        action: "preview",
        eventType,
        rendered,
      });
    }

    // Action: Send Email
    const sendResult = await EmailService.sendEvent({
      eventType: eventType as KeyEventType,
      to: targetEmail,
      payload: finalPayload,
    });

    return NextResponse.json({
      success: sendResult.success,
      action: "send",
      eventType,
      recipient: targetEmail,
      result: sendResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process email test request" },
      { status: 500 }
    );
  }
}
