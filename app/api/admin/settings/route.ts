import "reflect-metadata";
import { NextResponse } from "next/server";
import { getSettingRepository } from "@/lib/db/data-source";
import { getSession } from "@/lib/api-auth";
import { UserRole } from "@/lib/db/entities/User";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ success: false, error: "Unauthorized. SuperAdmin only." }, { status: 403 });
    }

    const settingRepo = await getSettingRepository();
    const settings = await settingRepo.find();
    
    // Convert array to key-value object for easier frontend consumption
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
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
    const session = await getSession();
    if (!session || session.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ success: false, error: "Unauthorized. SuperAdmin only." }, { status: 403 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ success: false, error: "Setting key is required." }, { status: 400 });
    }

    const settingRepo = await getSettingRepository();
    let setting = await settingRepo.findOneBy({ key });

    if (setting) {
      setting.value = value;
    } else {
      setting = settingRepo.create({ key, value });
    }

    await settingRepo.save(setting);

    return NextResponse.json({ success: true, message: "Setting updated successfully." });
  } catch (error: any) {
    console.error("Update setting error:", error);
    return NextResponse.json({ success: false, error: "Failed to update setting." }, { status: 500 });
  }
}
