import nodemailer from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";
import { getSettingRepository } from "@/lib/db/data-source";

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
  mode: "smtp" | "console";
  error?: string;
}

/**
 * Fetch SMTP config from the database, falling back to process.env.
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  let dbSettings: Record<string, string | null> = {};
  try {
    const settingRepo = await getSettingRepository();
    const settings = await settingRepo.find();
    dbSettings = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string | null>);
  } catch {
    console.warn("Could not load DB settings for SMTP config, falling back to env.");
  }

  const getVal = (key: string) => dbSettings[key] || process.env[key] || "";

  return {
    host: getVal("SMTP_HOST"),
    port: Number.parseInt(getVal("SMTP_PORT") || "587", 10),
    secure: getVal("SMTP_SECURE") === "true",
    user: getVal("SMTP_USER"),
    pass: getVal("SMTP_PASS"),
    fromName: getVal("SMTP_FROM_NAME") || "Supervision App",
    fromEmail: getVal("SMTP_FROM_EMAIL") || "noreply@supervision-app.com",
  };
}

export async function isSmtpConfigured(): Promise<boolean> {
  const config = await getSmtpConfig();
  return Boolean(config.host && config.port);
}

let cachedTransporter: Transporter | null = null;

export function clearTransporterCache() {
  cachedTransporter = null;
}

export async function createTransporter(): Promise<Transporter> {
  const config = await getSmtpConfig();
  const auth = config.user ? { user: config.user, pass: config.pass } : undefined;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

export async function getTransporter(): Promise<Transporter> {
  cachedTransporter ??= await createTransporter();
  return cachedTransporter;
}

/**
 * Verify the current SMTP connection.
 */
export async function verifySmtpConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  const configured = await isSmtpConfigured();
  if (!configured) {
    return {
      success: false,
      message: "SMTP is not configured. Set SMTP_HOST (and optionally SMTP_PORT, SMTP_USER, SMTP_PASS) via System Settings or environment variables.",
    };
  }
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    return {
      success: true,
      message: "SMTP connection verified successfully.",
      details: { config: await getSmtpConfig() },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `SMTP connection failed: ${error.message || "Unknown error"}`,
      details: { error: error.message },
    };
  }
}

/**
 * Send an email via the configured SMTP transport.
 * If SMTP is not configured, logs to console and returns success:false.
 */
export async function sendMail(options: EmailSendOptions): Promise<EmailSendResult> {
  const configured = await isSmtpConfigured();
  if (!configured) {
    console.warn(`[EMAIL SKIPPED] SMTP not configured. To: ${options.to} | Subject: ${options.subject}`);
    return { success: false, mode: "console", error: "SMTP not configured" };
  }

  const config = await getSmtpConfig();
  const from = `"${config.fromName}" <${config.fromEmail}>`;

  try {
    const transporter = await getTransporter();

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
    console.log(`[EMAIL SENT] ID: ${info.messageId} → ${options.to}`);

    return { success: true, messageId: info.messageId, mode: "smtp" };
  } catch (error: any) {
    console.error("[EMAIL ERROR]", error);
    return { success: false, mode: "smtp", error: error.message || "Failed to send email" };
  }
}
