export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  areasOfInterest?: string[] | null;
  createdAt?: string;
}

export interface ProgramInfo {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  supervisorCount: number;
  superviseeCount: number;
  createdBy?: { id: string; name: string; email: string } | null;
  userMembership?: { status: string; joinedAt: string } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface ProgramSupervisorItem {
  id: string;
  status: string;
  joinedAt?: string;
  supervisor: {
    id: string;
    name: string;
    email: string;
    areasOfInterest?: string[] | null;
  } | null;
}

export interface ApplicationItem {
  id: string;
  message?: string | null;
  status: string;
  createdAt: string;
  programId: string;
  program?: { id: string; name: string } | null;
  supervisee?: { id: string; name: string; email: string } | null;
  supervisor?: { id: string; name: string; email: string; areasOfInterest?: string[] | null } | null;
  group?: GroupItem | null;
}

export interface AssignmentItem {
  id: string;
  programId: string;
  program?: { id: string; name: string } | null;
  supervisor?: { id: string; name: string; email: string } | null;
  supervisee?: { id: string; name: string; email: string } | null;
  createdAt?: string;
}

export interface GroupMemberItem {
  id: string;
  status: string;
  user: { id: string; name: string; email: string };
}

export interface GroupItem {
  id: string;
  name: string;
  createdById: string;
  createdBy?: { id: string; name: string; email: string } | null;
  members: GroupMemberItem[];
}
