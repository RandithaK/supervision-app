import "reflect-metadata";
import { NextResponse } from "next/server";
import { getGroupRepository, getGroupMemberRepository, getSettingRepository } from "@/lib/db/data-source";
import { getAuthUser } from "@/lib/api-auth";
import { UserRole } from "@/lib/db/entities/User";
import { GroupMemberStatus } from "@/lib/db/entities/SuperviseeGroupMember";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const groupMemberRepo = await getGroupMemberRepository();
    const groupRepo = await getGroupRepository();

    if (authUser.role === UserRole.SUPERVISEE) {
      const allMemberships = await groupMemberRepo.find({
        where: { userId: authUser.id },
      });
      
      const activeRecord = allMemberships.find(m => m.status === GroupMemberStatus.ACTIVE);
      const pendingRecords = allMemberships.filter(m => m.status === GroupMemberStatus.PENDING);
      
      let currentGroup = null;
      if (activeRecord) {
        const group = await groupRepo.findOne({ where: { id: activeRecord.groupId }, relations: { createdBy: true } });
        const members = await groupMemberRepo.find({ where: { groupId: activeRecord.groupId }, relations: { user: true } });
        if (group) {
          currentGroup = {
            ...group,
            members: members.map(m => ({
              id: m.id,
              status: m.status,
              user: { id: m.user.id, name: m.user.name, email: m.user.email }
            }))
          };
        }
      }

      const invitations = [];
      for (const p of pendingRecords) {
        const g = await groupRepo.findOne({ where: { id: p.groupId }, relations: { createdBy: true } });
        if (g) {
          invitations.push({
            id: g.id,
            name: g.name,
            createdBy: g.createdBy
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        group: currentGroup,
        invitations
      });
    } else if (authUser.role === UserRole.ADMIN || authUser.role === UserRole.SUPERADMIN) {
      // Admin sees all groups
      const groups = await groupRepo.find({ relations: { createdBy: true } });
      return NextResponse.json({ success: true, groups });
    }
    
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser || authUser.role !== UserRole.SUPERVISEE) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const settingRepo = await getSettingRepository();
    const groupSetting = await settingRepo.findOneBy({ key: "ENABLE_GROUP_SUPERVISION" });
    if (groupSetting?.value !== "true") {
      return NextResponse.json({ success: false, error: "Group supervision is currently disabled." }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;
    if (!name) return NextResponse.json({ success: false, error: "Group name is required." }, { status: 400 });

    const groupMemberRepo = await getGroupMemberRepository();
    
    // Check if user is already in a group
    const existingMembership = await groupMemberRepo.findOne({ where: { userId: authUser.id } });
    if (existingMembership) {
      return NextResponse.json({ success: false, error: "You are already a member of a group." }, { status: 400 });
    }

    const groupRepo = await getGroupRepository();
    const newGroup = groupRepo.create({
      name,
      createdById: authUser.id,
    });
    await groupRepo.save(newGroup);

    const newMember = groupMemberRepo.create({
      groupId: newGroup.id,
      userId: authUser.id,
      status: GroupMemberStatus.ACTIVE,
    });
    await groupMemberRepo.save(newMember);

    return NextResponse.json({ success: true, group: newGroup }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
