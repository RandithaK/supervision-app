"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-notification";
import type {
  User,
  ProgramInfo,
  ProgramSupervisorItem,
  ApplicationItem as Application,
  AssignmentItem as Assignment,
  GroupItem as Group,
} from "@/types/portal";

function statusStyle(status: string) {
  if (status === "ACCEPTED") return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40";
  if (status === "WITHDRAWN") return "bg-muted text-muted-foreground border-border";
  return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40";
}

export default function SuperviseePortalPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Programs
  const [programs, setPrograms] = useState<ProgramInfo[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Program-scoped supervisors
  const [programSupervisors, setProgramSupervisors] = useState<ProgramSupervisorItem[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Group
  const [groupEnabled, setGroupEnabled] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [invitations, setInvitations] = useState<Group[]>([]);

  const [loadingData, setLoadingData] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [applyAsGroup, setApplyAsGroup] = useState(false);

  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedSupervisor, setSelectedSupervisor] = useState<ProgramSupervisorItem["supervisor"]>(null);
  const [appMessage, setAppMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  // Confirmation Modal
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "default";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        if (data.user.role !== "SUPERVISEE") {
          router.push(data.user.role === "ADMIN" || data.user.role === "SUPERADMIN" ? "/admin" : "/supervisor");
          return;
        }
        setCurrentUser(data.user);
      } else {
        router.push("/login?from=/supervisee");
      }
    } catch {
      router.push("/login?from=/supervisee");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch("/api/programs");
      const data = await res.json();
      if (data.success && Array.isArray(data.programs)) {
        setPrograms(data.programs);
        setSelectedProgramId((prev) => {
          if (prev && data.programs.some((p: ProgramInfo) => p.id === prev)) {
            return prev;
          }
          const joined = data.programs.find((p: ProgramInfo) => p.userMembership);
          return joined?.id || data.programs[0]?.id || null;
        });
      }
    } catch (err) {
      console.error("Failed to fetch programs:", err);
    }
  }, []);

  const fetchProgramData = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoadingData(true);
    try {
      const [supRes, appRes, assignRes, groupRes] = await Promise.all([
        fetch(`/api/programs/${selectedProgramId}/supervisors`),
        fetch(`/api/applications?programId=${selectedProgramId}`),
        fetch(`/api/assignments?programId=${selectedProgramId}`),
        fetch("/api/groups"),
      ]);
      const supData = await supRes.json();
      const appData = await appRes.json();
      const assignData = await assignRes.json();
      const groupData = await groupRes.json();

      if (supData.success) setProgramSupervisors(supData.supervisors);
      if (appData.success) setApplications(appData.applications);
      if (assignData.success) setAssignments(assignData.assignments);
      if (groupData.success) {
        setGroupEnabled(!!groupData.enabled);
        setCurrentGroup(groupData.group);
        setInvitations(groupData.invitations || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, [selectedProgramId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => { if (currentUser) fetchPrograms(); }, [currentUser, fetchPrograms]);
  useEffect(() => { if (currentUser && selectedProgramId) fetchProgramData(); }, [currentUser, selectedProgramId, fetchProgramData]);

  const supervisors = useMemo(() => {
    return programSupervisors
      .filter((ps) => ps.supervisor)
      .map((ps) => ps.supervisor!);
  }, [programSupervisors]);

  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    supervisors.forEach((s) => {
      if (Array.isArray(s.areasOfInterest)) s.areasOfInterest.forEach((t) => set.add(t));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [supervisors]);

  const filteredSupervisors = useMemo(() => {
    return supervisors.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (Array.isArray(s.areasOfInterest) && s.areasOfInterest.some((t) => t.toLowerCase().includes(q)));
      const matchesTag =
        selectedTagFilter === "ALL" ||
        (Array.isArray(s.areasOfInterest) && s.areasOfInterest.includes(selectedTagFilter));
      return matchesSearch && matchesTag;
    });
  }, [supervisors, selectedTagFilter, searchQuery]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervisor || !selectedProgramId) return;
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const body: any = {
        supervisorId: selectedSupervisor.id,
        message: appMessage,
        programId: selectedProgramId,
      };
      if (applyAsGroup && currentGroup) {
        body.groupId = currentGroup.id;
      }
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus({ success: true, msg: `Application to ${selectedSupervisor.name} submitted!` });
        addToast("success", `Application submitted to ${selectedSupervisor.name}.`);
        setAppMessage("");
        setApplyAsGroup(false);
        setSelectedSupervisor(null);
        fetchProgramData();
      } else {
        setSubmitStatus({ success: false, msg: data.error || "Failed to submit application" });
        addToast("error", data.error || "Failed to submit application.");
      }
    } catch (err: any) {
      setSubmitStatus({ success: false, msg: err.message || "Network error" });
      addToast("error", err.message || "Network error submitting application.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinProgram = async (programId: string) => {
    try {
      const res = await fetch(`/api/programs/${programId}/supervisees`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSelectedProgramId(programId);
        await fetchPrograms();
        addToast("success", "Successfully joined program.");
      } else {
        addToast("error", data.error || "Failed to join program.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Network error while joining program.");
    }
  };

  const handleLeaveProgram = (programId: string) => {
    const prog = programs.find((p) => p.id === programId);
    setConfirmDialog({
      isOpen: true,
      title: "Leave Program?",
      description: `Are you sure you want to leave "${prog?.name || "this program"}"? You can rejoin later if applications are still open.`,
      confirmText: "Leave Program",
      variant: "warning",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/programs/${programId}/supervisees`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            await fetchPrograms();
            if (selectedProgramId === programId) setSelectedProgramId(null);
            addToast("info", "You left the program.");
          } else {
            addToast("error", data.error || "Failed to leave program.");
          }
        } catch (err: any) {
          addToast("error", err.message || "Network error while leaving program.");
        }
      },
    });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName) return;
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName }),
      });
      const data = await res.json();
      if (data.success) {
        setNewGroupName("");
        fetchProgramData();
        addToast("success", `Group "${newGroupName}" created.`);
      } else {
        addToast("error", data.error || "Failed to create group.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail || !currentGroup) return;
    try {
      const res = await fetch(`/api/groups/${currentGroup.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newMemberEmail }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMemberEmail("");
        fetchProgramData();
        addToast("success", `Invitation sent to ${newMemberEmail}.`);
      } else {
        addToast("error", data.error || "Failed to add member.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentGroup) return;
    try {
      const res = await fetch(`/api/groups/${currentGroup.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        if (userId === currentUser?.id) setCurrentGroup(null);
        fetchProgramData();
        addToast("info", "Member removed from group.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
    }
  };

  const handleDisbandGroup = () => {
    if (!currentGroup) return;
    setConfirmDialog({
      isOpen: true,
      title: "Disband Group?",
      description: `Are you sure you want to disband "${currentGroup.name}"? All pending group invitations and applications will be cancelled.`,
      confirmText: "Disband Group",
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/groups/${currentGroup.id}`, { method: "DELETE" });
          if (res.ok) {
            setCurrentGroup(null);
            fetchProgramData();
            addToast("info", "Group disbanded successfully.");
          } else {
            const data = await res.json();
            addToast("error", data.error || "Failed to disband group.");
          }
        } catch (err: any) {
          addToast("error", err.message || "Request failed.");
        }
      },
    });
  };

  const handleInvitationAction = async (groupId: string, action: "ACCEPT" | "REJECT") => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchProgramData();
        addToast(action === "ACCEPT" ? "success" : "info", action === "ACCEPT" ? "Joined group!" : "Invitation rejected.");
      } else {
        addToast("error", data.error || "Failed to respond to invitation.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const activeAssignment = assignments[0];
  const assignedSupervisor = activeAssignment?.supervisor;

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);
  const joinedPrograms = programs.filter((p) => p.userMembership);
  const availablePrograms = programs.filter((p) => !p.userMembership && p.status === "ACTIVE");
  const isInSelectedProgram = selectedProgram?.userMembership != null;

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading Supervisee Portal…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Home</Link>
            <Separator orientation="vertical" className="h-4" />
            <span className="font-semibold text-sm">Supervisee Portal</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40">
              SUPERVISEE
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{currentUser.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">Log Out</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Supervision Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join a program, browse supervisors, and apply for supervision.
          </p>
        </div>

        <Separator />

        {/* Programs Section */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-blue-600 border-blue-500/30 bg-blue-500/10 mb-1">
              Programs
            </Badge>
            <CardTitle className="text-base font-bold">My Programs</CardTitle>
            <CardDescription className="text-xs">Join programs to access supervisors and apply for supervision.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Joined Programs */}
            {joinedPrograms.length > 0 && (
              <div className="space-y-2">
                {joinedPrograms.map((prog) => {
                  const isSelected = selectedProgramId === prog.id;
                  return (
                    <div
                      key={prog.id}
                      role="button"
                      tabIndex={0}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                      onClick={() => setSelectedProgramId(prog.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedProgramId(prog.id);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">{prog.name}</p>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono bg-emerald-100 text-emerald-700 border-emerald-200">
                            Joined
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {prog.supervisorCount} supervisors · {prog.superviseeCount} supervisees
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveProgram(prog.id);
                          }}
                          className="text-[10px] h-7 px-2"
                        >
                          Leave
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available Programs */}
            {availablePrograms.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide pt-2">Available Programs</p>
                {availablePrograms.map((prog) => (
                  <div key={prog.id} className="p-3 rounded-lg border border-dashed border-border flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{prog.name}</p>
                      {prog.description && <p className="text-[11px] text-muted-foreground truncate">{prog.description}</p>}
                    </div>
                    <Button size="sm" onClick={() => handleJoinProgram(prog.id)} className="text-xs h-7 font-semibold shrink-0">
                      Join →
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {joinedPrograms.length === 0 && availablePrograms.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                No programs available. Ask an admin to create one.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Scoped content for selected program */}
        {selectedProgram && isInSelectedProgram && (
          <>
            <div className="text-xs text-muted-foreground">
              Showing data for: <span className="font-semibold text-foreground">{selectedProgram.name}</span>
            </div>

            {/* Assignment status banner */}
            <Card className={`shadow-sm border-l-4 ${assignedSupervisor ? "border-l-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/10" : "border-l-amber-400 bg-amber-50/60 dark:bg-amber-900/10"}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">
                  {assignedSupervisor ? (
                    <span>Assigned to <span className="text-emerald-700 dark:text-emerald-400">{assignedSupervisor.name}</span></span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">Not Yet Assigned</span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {assignedSupervisor
                    ? `You have an active supervision assignment. Contact: ${assignedSupervisor.email}`
                    : "Browse the supervisor directory below and submit an application."}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Submit status message */}
            {submitStatus && (
              <div className={`p-3 rounded-lg border text-xs font-medium ${
                submitStatus.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300"
                  : "bg-destructive/10 border-destructive/25 text-destructive"
              }`}>
                {submitStatus.msg}
              </div>
            )}

            {/* Application form */}
            {selectedSupervisor && (
              <Card className="shadow-sm border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold">
                      Apply to {selectedSupervisor.name}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSupervisor(null)} className="text-xs text-muted-foreground">
                      Cancel
                    </Button>
                  </div>
                  <CardDescription className="text-xs">{selectedSupervisor.email}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleApply} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="app-message" className="text-xs font-semibold uppercase tracking-wide">
                        Statement of Interest <span className="text-muted-foreground normal-case tracking-normal">(optional)</span>
                      </Label>
                      <Textarea
                        id="app-message"
                        rows={3}
                        value={appMessage}
                        onChange={(e) => setAppMessage(e.target.value)}
                        placeholder="Briefly describe your goals and why you'd like this supervisor…"
                        className="text-xs resize-none"
                      />
                    </div>
                    {groupEnabled && currentGroup && currentGroup.createdById === currentUser.id && (
                      <div className="flex items-center space-x-2 pt-1 pb-1">
                        <Checkbox id="apply-group" checked={applyAsGroup} onCheckedChange={(c) => setApplyAsGroup(c as boolean)} />
                        <label htmlFor="apply-group" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Apply on behalf of my group ({currentGroup.name})
                        </label>
                      </div>
                    )}
                    <Button type="submit" disabled={submitting} className="font-semibold text-xs">
                      {submitting ? "Submitting…" : "Submit Application →"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Group Management Section (if enabled) */}
              {groupEnabled && (
                <Card className="shadow-sm lg:col-span-3">
                  <CardHeader className="pb-4">
                    <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40 mb-1">
                      Group Supervision
                    </Badge>
                    <CardTitle className="text-base font-bold">My Group</CardTitle>
                    <CardDescription className="text-xs">Form a group to apply for supervision together.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {invitations.length > 0 && !currentGroup && (
                      <div className="mb-6 space-y-3">
                        <h3 className="text-sm font-semibold uppercase text-blue-700 dark:text-blue-400">Pending Invitations</h3>
                        <div className="space-y-2">
                          {invitations.map((inv) => (
                            <div key={inv.id} className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold">{inv.name}</p>
                                <p className="text-[11px] text-muted-foreground">Invited by: {(inv as any).createdBy?.name}</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button size="sm" onClick={() => handleInvitationAction(inv.id, "ACCEPT")} className="text-xs h-7 bg-emerald-600 hover:bg-emerald-500 text-white">Accept</Button>
                                <Button size="sm" variant="outline" onClick={() => handleInvitationAction(inv.id, "REJECT")} className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50">Reject</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Separator className="my-4" />
                      </div>
                    )}

                    {!currentGroup ? (
                      <div className="flex items-center gap-4">
                        <form onSubmit={handleCreateGroup} className="flex gap-2 w-full max-w-sm">
                          <Input
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Group Name (e.g. Project Alpha)"
                            className="text-xs"
                          />
                          <Button type="submit" size="sm" className="text-xs shrink-0 font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                            Create Group
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm">
                            {currentGroup.name}
                            {currentGroup.createdById === currentUser.id && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Leader</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {currentGroup.createdById === currentUser.id ? (
                              <Button variant="destructive" size="sm" onClick={handleDisbandGroup} className="text-[10px] h-7">Disband</Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => handleRemoveMember(currentUser.id)} className="text-[10px] h-7">Leave</Button>
                            )}
                          </div>
                        </div>

                        <div className="rounded-md border p-2 bg-muted/20">
                          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">Members ({currentGroup.members?.length || 0})</p>
                          <ul className="space-y-2">
                            {currentGroup.members?.map((m) => (
                              <li key={m.id} className="flex items-center justify-between text-xs">
                                <span>
                                  {m.user.name} <span className="text-muted-foreground">({m.user.email})</span>
                                  {m.status === "PENDING" && <Badge variant="outline" className="ml-2 text-[9px] uppercase bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>}
                                </span>
                                {currentGroup.createdById === currentUser.id && m.user.id !== currentUser.id && (
                                  <button onClick={() => handleRemoveMember(m.user.id)} className="text-red-500 hover:underline text-[10px]">Remove</button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {currentGroup.createdById === currentUser.id && (
                          <form onSubmit={handleAddMember} className="flex gap-2 max-w-sm">
                            <Input
                              value={newMemberEmail}
                              onChange={(e) => setNewMemberEmail(e.target.value)}
                              placeholder="Invitee Email Address"
                              className="text-xs h-8"
                            />
                            <Button type="submit" size="sm" variant="secondary" className="text-xs h-8">Add Member</Button>
                          </form>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Supervisor directory (scoped to program) */}
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-primary border-primary/30 bg-primary/5 mb-1">
                        Directory ({supervisors.length})
                      </Badge>
                      <CardTitle className="text-base font-bold">Program Supervisors</CardTitle>
                      <CardDescription className="text-xs">Supervisors available in this program. Filter by interest or search.</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={fetchProgramData} className="text-xs shrink-0">
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Search & filter */}
                  <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</Label>
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Name, email or area of interest…"
                        className="text-xs"
                      />
                    </div>
                    {allAvailableTags.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter by Interest</Label>
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <Button
                            type="button"
                            variant={selectedTagFilter === "ALL" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedTagFilter("ALL")}
                            className="text-xs h-7 px-3"
                          >
                            All ({supervisors.length})
                          </Button>
                          {allAvailableTags.map((tag) => (
                            <Button
                              key={tag}
                              type="button"
                              variant={selectedTagFilter === tag ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedTagFilter(tag)}
                              className="text-xs h-7 px-3"
                            >
                              {tag}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supervisor list */}
                  {loadingData ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">Loading supervisors…</p>
                  ) : filteredSupervisors.length === 0 ? (
                    <div className="py-8 text-center border border-dashed rounded-lg space-y-2">
                      <p className="text-xs text-muted-foreground">No supervisors match your filter.</p>
                      {(selectedTagFilter !== "ALL" || searchQuery) && (
                        <Button variant="link" size="sm" onClick={() => { setSelectedTagFilter("ALL"); setSearchQuery(""); }} className="text-xs">
                          Reset filters
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                      {filteredSupervisors.map((s) => (
                        <div key={s.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                          <div className="space-y-1.5 flex-1">
                            <div>
                              <p className="font-semibold text-sm">{s.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{s.email}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {Array.isArray(s.areasOfInterest) && s.areasOfInterest.length > 0 ? (
                                s.areasOfInterest.map((tag) => (
                                  <Badge
                                    key={tag}
                                    role="button"
                                    tabIndex={0}
                                    variant="outline"
                                    onClick={() => setSelectedTagFilter(tag)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setSelectedTagFilter(tag);
                                      }
                                    }}
                                    className={`text-[11px] cursor-pointer transition-colors ${
                                      selectedTagFilter === tag
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-primary/8 text-primary border-primary/25 hover:bg-primary/15"
                                    }`}
                                  >
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground italic">General Supervision</span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {assignedSupervisor ? (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                Already Assigned
                              </Badge>
                            ) : (
                              <Button size="sm" onClick={() => setSelectedSupervisor(s)} className="text-xs font-semibold">
                                Apply →
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* My applications */}
              <Card className="shadow-sm lg:col-span-1">
                <CardHeader className="pb-4">
                  <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40 mb-1">
                    My Applications
                  </Badge>
                  <CardTitle className="text-base font-bold">Application Status</CardTitle>
                  <CardDescription className="text-xs">Track your submitted supervision requests in this program.</CardDescription>
                </CardHeader>
                <CardContent>
                  {applications.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                      No applications yet. Pick a supervisor and apply!
                    </p>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                      {applications.map((app) => (
                        <div key={app.id} className="p-3.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate">{app.supervisor?.name ?? "Supervisor"}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {app.group && (
                                <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">
                                  GROUP
                                </Badge>
                              )}
                              <Badge variant="outline" className={`text-[10px] uppercase font-mono shrink-0 ${statusStyle(app.status)}`}>
                                {app.status}
                              </Badge>
                            </div>
                          </div>
                          {app.message && (
                            <p className="text-muted-foreground text-[11px] truncate italic">&ldquo;{app.message}&rdquo;</p>
                          )}
                          {app.status === "WITHDRAWN" && (
                            <p className="text-[10px] text-muted-foreground">
                              Auto-withdrawn — another supervisor accepted your request.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </>
        )}
      </main>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
