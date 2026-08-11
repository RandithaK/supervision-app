import "reflect-metadata";
import { NextResponse } from "next/server";
import { getGroupRepository, getGroupMemberRepository, getApplicationRepository } from "@/lib/db/data-source";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { groupId } = await context.params;
    
    const groupRepo = await getGroupRepository();
    const group = await groupRepo.findOne({ where: { id: groupId }, relations: { createdBy: true } });
    if (!group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });

    const groupMemberRepo = await getGroupMemberRepository();
    const members = await groupMemberRepo.find({ where: { groupId }, relations: { user: true } });

    return NextResponse.json({
      success: true,
      group: {
        ...group,
        members: members.map(m => ({
          id: m.id,
          status: m.status,
          user: { id: m.user.id, name: m.user.name, email: m.user.email }
        }))
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { groupId } = await context.params;
    const groupRepo = await getGroupRepository();
    const group = await groupRepo.findOneBy({ id: groupId });

    if (!group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });

    // Only creator or admin can disband
    if (group.createdById !== authUser.id && authUser.role !== "ADMIN" && authUser.role !== "SUPERADMIN") {
      return NextResponse.json({ success: false, error: "Only the group leader can disband the group." }, { status: 403 });
    }

    // Check if they have an accepted group application
    const appRepo = await getApplicationRepository();
    const acceptedApp = await appRepo.findOneBy({ groupId, status: "ACCEPTED" as any });
    if (acceptedApp) {
      return NextResponse.json({ success: false, error: "Cannot disband a group that has an accepted supervision application." }, { status: 400 });
    }

    // Delete group (cascade should handle members, but we can delete them explicitly or rely on FK cascade)
    // The SuperviseeGroupMember entity has onDelete: "CASCADE" on the group relation
    await groupRepo.remove(group);

    return NextResponse.json({ success: true, message: "Group disbanded successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
