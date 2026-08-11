import fs from "fs";
import path from "path";
import yaml from "yaml";

export type KeyEventType =
  | "WELCOME_USER"
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_RECEIVED"
  | "APPLICATION_STATUS_UPDATED"
  | "ASSIGNMENT_CREATED"
  | "PASSWORD_RESET"
  | "SYSTEM_ALERT"
  | "OTP_VERIFICATION";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface YamlTemplate {
  subject: string;
  title?: string;
  badge?: {
    text: string;
    color?: string;
  };
  content: string;
  details?: Array<{ label: string; value: string }>;
  cta?: {
    label: string;
    url: string;
  };
  footerText?: string;
}

// Map color names to theme hex codes based on globals.css light mode
const THEME_COLORS: Record<string, { bg: string; text: string }> = {
  primary: { bg: "#e0e7ff", text: "#4f46e5" }, // Indigo / primary
  secondary: { bg: "#f3e8ff", text: "#7e22ce" }, // Lavender / secondary
  destructive: { bg: "#fee2e2", text: "#b91c1c" }, // Rose / destructive
  muted: { bg: "#f1f5f9", text: "#475569" }, // Slate / muted
  accent: { bg: "#fce7f3", text: "#be185d" }, // Pink / accent
  blue: { bg: "#e0f2fe", text: "#0369a1" },
  green: { bg: "#dcfce7", text: "#15803d" },
  yellow: { bg: "#fef9c3", text: "#a16207" },
};

/**
 * Replaces {{variableKey}} in a string template with values from payload object.
 */
export function renderTemplateString(templateStr: string, data: Record<string, any>): string {
  if (!templateStr) return "";
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, keyPath) => {
    const keys = keyPath.split(".");
    let val: any = data;
    for (const key of keys) {
      if (val && typeof val === "object" && key in val) {
        val = val[key];
      } else {
        val = undefined;
        break;
      }
    }
    return val !== undefined && val !== null ? String(val) : "";
  });
}

/**
 * Convert HTML to clean plain text fallback
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  let text = html;
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "$2 ($1)");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|h1|h2|h3|h4|h5|h6|div|tr|li)>/gi, "\n");
  text = text.replace(/<tr[^>]*>/gi, "\n");
  text = text.replace(/<td[^>]*>/gi, " | ");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n").trim();
  return text;
}

/**
 * Wraps content in a styled HTML Base Shell
 */
function wrapInBaseShell(template: YamlTemplate, payload: Record<string, any>): string {
  const title = renderTemplateString(template.title || "", payload);
  let badgeHtml = "";
  
  if (template.badge) {
    const badgeText = renderTemplateString(template.badge.text, payload);
    // Dynamic color parsing logic
    let colorKey = renderTemplateString(template.badge.color || "primary", payload).toLowerCase();
    
    // Map status/severity words directly to theme colors if they sneak in
    if (colorKey === "approved") colorKey = "green";
    if (colorKey === "rejected" || colorKey === "critical") colorKey = "destructive";
    if (colorKey === "under_review" || colorKey === "warning") colorKey = "yellow";
    if (colorKey === "pending" || colorKey === "info") colorKey = "blue";
    
    const style = THEME_COLORS[colorKey] || THEME_COLORS.primary;
    badgeHtml = `<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background-color: ${style.bg}; color: ${style.text}">${badgeText}</span>`;
  }

  const contentHtml = renderTemplateString(template.content, payload);
  let tableHtml = "";

  if (template.details && template.details.length > 0) {
    const rows = template.details
      .map((row) => {
        const label = renderTemplateString(row.label, payload);
        const value = renderTemplateString(row.value, payload);
        return `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #475569; width: 35%; font-size: 14px;">${label}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px;">${value}</td>
      </tr>
    `;
      }).join("");

    tableHtml = `
      <div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #f8fafc;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  let buttonHtml = "";
  if (template.cta) {
    const btnLabel = renderTemplateString(template.cta.label, payload);
    const btnUrl = renderTemplateString(template.cta.url, payload);
    buttonHtml = `
      <div style="margin: 28px 0 16px 0; text-align: center;">
        <a href="${btnUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
          ${btnLabel}
        </a>
      </div>
    `;
  }

  const footerText = renderTemplateString(template.footerText || "This is an automated notification from Supervision App.", payload);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || "Supervision App Notification"}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">
                      ⚡ Supervision Portal
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              ${badgeHtml ? `<div style="margin-bottom: 16px;">${badgeHtml}</div>` : ""}
              ${title ? `<h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 22px; font-weight: 700; letter-spacing: -0.01em;">${title}</h2>` : ""}
              
              <div style="font-size: 15px; color: #334155;">
                ${contentHtml}
              </div>

              ${tableHtml}
              ${buttonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 13px; color: #64748b;">
              <p style="margin: 0 0 6px 0;">${footerText}</p>
              <p style="margin: 0;">© ${new Date().getFullYear()} Supervision App. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export class TemplateEngine {
  /**
   * Render email by key event type using YAML template files
   */
  static renderKeyEvent(eventType: KeyEventType, payload: Record<string, any>): RenderedEmail {
    try {
      // 1. Read YAML template from filesystem
      const templatePath = path.join(process.cwd(), "lib", "email", "templates", `${eventType}.yml`);
      const fileContents = fs.readFileSync(templatePath, "utf8");
      
      // 2. Parse YAML
      const templateData = yaml.parse(fileContents) as YamlTemplate;
      
      if (!templateData || !templateData.subject || !templateData.content) {
        throw new Error("Invalid template format: Missing required fields (subject, content).");
      }

      // 3. Render final output
      const subject = renderTemplateString(templateData.subject, payload);
      const html = wrapInBaseShell(templateData, payload);
      const text = htmlToPlainText(html);

      return { subject, html, text };
    } catch (error: any) {
      console.error(`Failed to load or parse template for event: ${eventType}`, error);
      throw new Error(`Failed to render template ${eventType}: ${error.message}`);
    }
  }
}
