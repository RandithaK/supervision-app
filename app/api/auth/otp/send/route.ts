import "reflect-metadata";
import { NextResponse } from "next/server";
import { getUserRepository, getOtpRepository, getSettingRepository } from "@/lib/db/data-source";
import { EmailService } from "@/lib/email";

// Generate a random 6-digit number
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid email address is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const userRepo = await getUserRepository();
    const existingUser = await userRepo.findOneBy({ email: normalizedEmail });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // 1.5 Validate Domain Restrictions
    const settingRepo = await getSettingRepository();
    const domainSetting = await settingRepo.findOneBy({ key: "ALLOWED_REGISTRATION_DOMAINS" });
    
    if (domainSetting && domainSetting.value && domainSetting.value.trim().length > 0) {
      const allowedDomains = domainSetting.value.split(",").map(d => d.trim().toLowerCase());
      const emailDomain = normalizedEmail.split("@")[1];
      
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        return NextResponse.json(
          { success: false, error: `Registration is restricted to the following domains: ${allowedDomains.join(", ")}` },
          { status: 403 }
        );
      }
    }

    // 2. Generate OTP and calculate expiration (10 minutes)
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // 3. Upsert OTP record
    const otpRepo = await getOtpRepository();
    let otpRecord = await otpRepo.findOneBy({ email: normalizedEmail });
    
    if (otpRecord) {
      otpRecord.otp = otp;
      otpRecord.expiresAt = expiresAt;
    } else {
      otpRecord = otpRepo.create({
        email: normalizedEmail,
        otp,
        expiresAt,
      });
    }
    
    await otpRepo.save(otpRecord);

    // 4. Dispatch Email
    await EmailService.sendEvent({
      eventType: "OTP_VERIFICATION",
      to: normalizedEmail,
      payload: {
        otp,
      }
    });

    return NextResponse.json(
      { success: true, message: "Verification code sent successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send verification code." },
      { status: 500 }
    );
  }
}
