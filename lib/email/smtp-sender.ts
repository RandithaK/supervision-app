import nodemailer from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromName: string;
  fromEmail: string;
}

export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  mode: "smtp" | "ethereal" | "console";
  error?: string;
}

export function getSmtpConfig(): SmtpConfig {
  return {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    fromName: process.env.SMTP_FROM_NAME || "Supervision App",
    fromEmail: process.env.SMTP_FROM_EMAIL || "noreply@supervision-app.com",
  };
}

export function isSmtpConfigured(): boolean {
  const config = getSmtpConfig();
  return Boolean(config.host && config.port);
}

let cachedTransporter: Transporter | null = null;

export async function createTransporter(): Promise<{ transporter: Transporter; mode: "smtp" | "ethereal" | "console" }> {
  const config = getSmtpConfig();

  // If host and user/port are configured, use standard SMTP transport
  if (config.host) {
    const auth = config.user ? { user: config.user, pass: config.pass } : undefined;
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
    return { transporter, mode: "smtp" };
  }

  // Fallback 1: In development without SMTP credentials, try creating an Ethereal test account
  if (process.env.NODE_ENV !== "production") {
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      return { transporter, mode: "ethereal" };
    } catch (err) {
      console.warn("Failed to create Ethereal test account for dev email, using JSON stream/console fallback:", err);
    }
  }

  // Fallback 2: Stream transport (logs to JSON/console safely)
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
  return { transporter, mode: "console" };
}

export async function getTransporter(): Promise<{ transporter: Transporter; mode: "smtp" | "ethereal" | "console" }> {
  if (!cachedTransporter) {
    const res = await createTransporter();
    cachedTransporter = res.transporter;
    return res;
  }
  const mode = isSmtpConfigured() ? "smtp" : "console";
  return { transporter: cachedTransporter, mode };
}

/**
 * Verify current SMTP connection
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const { transporter, mode } = await createTransporter();
    if (mode === "console") {
      return {
        success: true,
        message: "SMTP is running in Console Fallback mode (No SMTP host defined in environment variables).",
        details: { mode },
      };
    }
    const verified = await transporter.verify();
    return {
      success: true,
      message: `SMTP Connection successfully verified (${mode.toUpperCase()} mode).`,
      details: { verified, mode, config: getSmtpConfig() },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `SMTP Connection failed: ${error.message || "Unknown error"}`,
      details: { error: error.message },
    };
  }
}

/**
 * Send an email via the configured SMTP transport
 */
export async function sendMail(options: EmailSendOptions): Promise<EmailSendResult> {
  const config = getSmtpConfig();
  const from = `"${config.fromName}" <${config.fromEmail}>`;

  try {
    const { transporter, mode } = await getTransporter();

    const mailOptions: SendMailOptions = {
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
    };

    const info = await transporter.sendMail(mailOptions);
    let previewUrl: string | false = false;

    if (mode === "ethereal") {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[EMAIL DISPATCH] Ethereal Preview URL: ${previewUrl}`);
    } else if (mode === "console") {
      console.log(`[EMAIL DISPATCH - CONSOLE FALLBACK] To: ${options.to} | Subject: ${options.subject}`);
    } else {
      console.log(`[EMAIL DISPATCH - SMTP] Sent message ID: ${info.messageId} to ${options.to}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      mode,
    };
  } catch (error: any) {
    console.error("[EMAIL DISPATCH ERROR]", error);
    return {
      success: false,
      mode: isSmtpConfigured() ? "smtp" : "console",
      error: error.message || "Failed to send email",
    };
  }
}
