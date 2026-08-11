import "reflect-metadata";
import { NextResponse } from "next/server";
import { getGroupRepository, getGroupMemberRepository, getUserRepository, getAssignmentRepository } from "@/lib/db/data-source";
import { getAuthUser } from "@/lib/api-auth";
import { UserRole } from "@/lib/db/entities/User";
import { GroupMemberStatus } from "@/lib/db/entities/SuperviseeGroupMember";
import { EmailService } from "@/lib/email";

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { groupId } = await context.params;
    const body = await request.json();
    const { email } = body;

    if (!email) return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });

    const groupRepo = await getGroupRepository();
    const group = await groupRepo.findOneBy({ id: groupId });

    if (!group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });
    if (group.createdById !== authUser.id) {
      return NextResponse.json({ success: false, error: "Only the group leader can add members." }, { status: 403 });
    }

    const userRepo = await getUserRepository();
    const invitee = await userRepo.findOneBy({ email: email.toLowerCase() });

    if (!invitee) {
      return NextResponse.json({ success: false, error: "No user found with that email address." }, { status: 404 });
    }
    if (invitee.role !== UserRole.SUPERVISEE) {
      return NextResponse.json({ success: false, error: "Only Supervisees can be added to a group." }, { status: 400 });
    }
    
    const groupMemberRepo = await getGroupMemberRepository();
    // Allow inviting if they have a PENDING membership in another group, but not if they are ACTIVE in any group
    const activeMembership = await groupMemberRepo.findOneBy({ userId: invitee.id, status: GroupMemberStatus.ACTIVE });
    if (activeMembership) {
      return NextResponse.json({ success: false, error: "User is already an active member of a group." }, { status: 400 });
    }
    
    const existingMembershipInThisGroup = await groupMemberRepo.findOneBy({ userId: invitee.id, groupId });
    if (existingMembershipInThisGroup) {
      return NextResponse.json({ success: false, error: "User has already been invited to this group." }, { status: 400 });
    }

    const assignmentRepo = await getAssignmentRepository();
    const existingAssignment = await assignmentRepo.findOneBy({ superviseeId: invitee.id });
    if (existingAssignment) {
      return NextResponse.json({ success: false, error: "User is already assigned to a supervisor." }, { status: 400 });
    }

    const newMember = groupMemberRepo.create({
      groupId,
      userId: invitee.id,
      status: GroupMemberStatus.PENDING,
    });
    await groupMemberRepo.save(newMember);

    // Send email notification (non-blocking)
    EmailService.sendEvent({
      eventType: "GROUP_INVITATION",
      to: invitee.email,
      payload: {
        userName: invitee.name,
        groupName: group.name,
        leaderName: authUser.name,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/supervisee`,
      }
    }).catch(console.error);

    return NextResponse.json({ success: true, member: newMember }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { groupId } = await context.params;
    const body = await request.json();
    const { action } = body; // "ACCEPT" | "REJECT"

    if (!action || !["ACCEPT", "REJECT"].includes(action)) {
      return NextResponse.json({ success: false, error: "Valid action (ACCEPT or REJECT) is required" }, { status: 400 });
    }

    const groupMemberRepo = await getGroupMemberRepository();
    const member = await groupMemberRepo.findOneBy({ groupId, userId: authUser.id, status: GroupMemberStatus.PENDING });

    if (!member) {
      return NextResponse.json({ success: false, error: "Pending invitation not found." }, { status: 404 });
    }

    if (action === "ACCEPT") {
      // Ensure they aren't already active in another group
      const activeMembership = await groupMemberRepo.findOneBy({ userId: authUser.id, status: GroupMemberStatus.ACTIVE });
      if (activeMembership) {
        return NextResponse.json({ success: false, error: "You are already active in another group. Leave it first." }, { status: 400 });
      }
      
      member.status = GroupMemberStatus.ACTIVE;
      await groupMemberRepo.save(member);
      
      // Optionally reject all other pending invitations
      const otherInvites = await groupMemberRepo.find({ where: { userId: authUser.id, status: GroupMemberStatus.PENDING } });
      if (otherInvites.length > 0) {
        await groupMemberRepo.remove(otherInvites);
      }
      
      return NextResponse.json({ success: true, message: "Invitation accepted" });
    } else {
      // REJECT
      await groupMemberRepo.remove(member);
      return NextResponse.json({ success: true, message: "Invitation rejected" });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ groupId: string }> }) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { groupId } = await context.params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) return NextResponse.json({ success: false, error: "User ID is required" }, { status: 400 });

    const groupRepo = await getGroupRepository();
    const group = await groupRepo.findOneBy({ id: groupId });

    if (!group) return NextResponse.json({ success: false, error: "Group not found" }, { status: 404 });

    const groupMemberRepo = await getGroupMemberRepository();
    const member = await groupMemberRepo.findOneBy({ groupId, userId });

    if (!member) return NextResponse.json({ success: false, error: "User is not a member of this group" }, { status: 404 });

    // Only leader can kick, or user can leave themselves
    if (group.createdById !== authUser.id && authUser.id !== userId) {
      return NextResponse.json({ success: false, error: "Unauthorized to remove this member" }, { status: 403 });
    }

    if (group.createdById === userId) {
      return NextResponse.json({ success: false, error: "The group leader cannot leave the group. Disband the group instead." }, { status: 400 });
    }

    await groupMemberRepo.remove(member);

    return NextResponse.json({ success: true, message: "Member removed successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
