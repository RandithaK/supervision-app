import { NextResponse } from "next/server";
import { getSettingRepository } from "@/lib/db/data-source";

export async function GET() {
  try {
    const settingRepo = await getSettingRepository();
    const groupSetting = await settingRepo.findOneBy({ key: "ENABLE_GROUP_SUPERVISION" });
    
    return NextResponse.json({
      success: true,
      enabled: groupSetting?.value === "true"
    });
  } catch (error: any) {
    console.error("Public settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch public settings" },
      { status: 500 }
    );
  }
}
