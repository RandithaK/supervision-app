import "reflect-metadata";
import { NextResponse } from "next/server";
import { getSettingRepository } from "@/lib/db/data-source";
import { getAuthUser } from "@/lib/api-auth";
import { UserRole } from "@/lib/db/entities/User";
import { clearTransporterCache } from "@/lib/email/smtp-sender";

export async function GET(request: Request) {
  try {
    const session = await getAuthUser(request);
    if (!session || session.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ success: false, error: "Unauthorized. SuperAdmin only." }, { status: 403 });
    }

    const settingRepo = await getSettingRepository();
    const settings = await settingRepo.find();
    
    // Convert array to key-value object for easier frontend consumption
    const settingsMap = settings.reduce((acc, setting) => {
      // Mask password for frontend
      if (setting.key === "SMTP_PASS" && setting.value) {
        acc[setting.key] = "********";
      } else {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {} as Record<string, string | null>);

    return NextResponse.json({ success: true, settings: settingsMap });
  } catch (error: any) {
    console.error("Fetch settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch settings." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthUser(request);
    if (!session || session.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ success: false, error: "Unauthorized. SuperAdmin only." }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ success: false, error: "Settings array is required." }, { status: 400 });
    }

    const settingRepo = await getSettingRepository();
    
    for (const item of settings) {
      const { key, value } = item;
      if (!key) continue;

      // Skip password if it's the masked placeholder
      if (key === "SMTP_PASS" && value === "********") {
        continue;
      }

      let setting = await settingRepo.findOneBy({ key });

      if (value === "" || value === null || value === undefined) {
        if (setting) {
          await settingRepo.remove(setting);
        }
      } else {
        if (setting) {
          setting.value = value;
        } else {
          setting = settingRepo.create({ key, value });
        }
        await settingRepo.save(setting);
      }
    }

    // Force SMTP module to reconnect on next dispatch if SMTP settings were updated
    const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_NAME", "SMTP_FROM_EMAIL"];
    if (settings.some(s => smtpKeys.includes(s.key))) {
      clearTransporterCache();
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully." });
  } catch (error: any) {
    console.error("Update setting error:", error);
    return NextResponse.json({ success: false, error: "Failed to update settings." }, { status: 500 });
  }
}
