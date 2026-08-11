import { sendMail, verifySmtpConnection } from "./smtp-sender";
import type { EmailSendResult } from "./smtp-sender";
import { TemplateEngine } from "./template-engine";
import type { KeyEventType } from "./template-engine";

export interface SendEventOptions {
  eventType: KeyEventType;
  to: string | string[];
  payload: Record<string, any>;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export class EmailService {
  /**
   * Verify SMTP connection status
   */
  static async verifyConnection() {
    return verifySmtpConnection();
  }

  /**
   * Render and dispatch an email based on a YAML template event
   */
  static async sendEvent(options: SendEventOptions): Promise<EmailSendResult> {
    try {
      const rendered = TemplateEngine.renderKeyEvent(options.eventType, options.payload);
      return await sendMail({
        to: options.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
      });
    } catch (error: any) {
      console.error(`[EMAIL SERVICE ERROR - ${options.eventType}]`, error);
      return {
        success: false,
        mode: "console",
        error: error.message || "Failed to render and send email",
      };
    }
  }
}
