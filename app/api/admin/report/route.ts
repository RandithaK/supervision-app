import "reflect-metadata";
import { NextResponse } from "next/server";
import {
  getUserRepository,
  getAssignmentRepository,
  getApplicationRepository,
} from "@/lib/db/data-source";
import { UserRole } from "@/lib/db/entities/User";
import { ApplicationStatus } from "@/lib/db/entities/SupervisionApplication";
import { getAuthUser } from "@/lib/api-auth";

// GET /api/admin/report
// Returns all supervisors with their assigned supervisees + statement of interest.
// Admin / SuperAdmin only.
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (authUser.role !== UserRole.ADMIN && authUser.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ success: false, error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const userRepo       = await getUserRepository();
    const assignRepo     = await getAssignmentRepository();
    const appRepo        = await getApplicationRepository();

    // All supervisors
    const supervisors = await userRepo.find({
      where: { role: UserRole.SUPERVISOR },
      order: { name: "ASC" },
    });

    // All assignments (with supervisee)
    const assignments = await assignRepo.find({
      relations: { supervisee: true, supervisor: true },
    });

    // All accepted applications (to get statement of interest)
    const acceptedApps = await appRepo.find({
      where: { status: ApplicationStatus.ACCEPTED },
      relations: { supervisee: true, supervisor: true },
    });

    // Build per-supervisor report rows
    const report = supervisors.map((sup) => {
      const supAssignments = assignments.filter((a) => a.supervisor?.id === sup.id);

      const students = supAssignments.map((a) => {
        const app = acceptedApps.find(
          (ap) => ap.supervisor?.id === sup.id && ap.supervisee?.id === a.supervisee?.id
        );
        return {
          name:        a.supervisee?.name  ?? "—",
          email:       a.supervisee?.email ?? "—",
          assignedDate: new Date(a.createdAt).toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
          }),
          statement: app?.message ?? "",
        };
      });

      const areasOfInterest: string[] = Array.isArray(sup.areasOfInterest)
        ? sup.areasOfInterest
        : typeof sup.areasOfInterest === "string" && sup.areasOfInterest
        ? (sup.areasOfInterest as string).split(",").map((t) => t.trim()).filter(Boolean)
        : [];

      return {
        id:              sup.id,
        name:            sup.name,
        email:           sup.email,
        areasOfInterest,
        studentCount:    students.length,
        students,
      };
    });

    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
