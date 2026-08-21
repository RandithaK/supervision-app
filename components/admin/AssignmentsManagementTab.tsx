"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-notification";
import {
  AlertCircle,
  CheckCircle2,
  GitMerge,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import type { ProgramInfo, AssignmentItem, User as UserAccount } from "@/types/portal";

interface AssignmentsManagementTabProps {
  programs: ProgramInfo[];
  users: UserAccount[];
  onRefreshData?: () => void;
}

export function AssignmentsManagementTab({
  programs,
  users,
  onRefreshData,
}: AssignmentsManagementTabProps) {
  const { addToast } = useToast();

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Creation Form State
  const [createProgramId, setCreateProgramId] = useState<string>("");
  const [createSuperviseeId, setCreateSuperviseeId] = useState<string>("");
  const [createSupervisorId, setCreateSupervisorId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [formMsg, setFormMsg] = useState<{ success?: boolean; msg?: string } | null>(null);

  // Reassign Modal State
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean;
    assignment: AssignmentItem | null;
    newSupervisorId: string;
    loading: boolean;
  }>({
    isOpen: false,
    assignment: null,
    newSupervisorId: "",
    loading: false,
  });

  // Revoke Dialog State
  const [revokeDialog, setRevokeDialog] = useState<{
    isOpen: boolean;
    assignmentId: string | null;
    superviseeName: string;
    programName: string;
    loading: boolean;
  }>({
    isOpen: false,
    assignmentId: null,
    superviseeName: "",
    programName: "",
    loading: false,
  });

  // Separate supervisors and supervisees from users list
  const supervisors = useMemo(
    () => users.filter((u) => u.role === "SUPERVISOR"),
    [users]
  );
  const supervisees = useMemo(
    () => users.filter((u) => u.role === "SUPERVISEE"),
    [users]
  );

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        selectedProgramFilter && selectedProgramFilter !== "ALL"
          ? `/api/assignments?programId=${selectedProgramFilter}`
          : "/api/assignments";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        addToast("error", data.error || "Failed to fetch assignments.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Network error fetching assignments.");
    } finally {
      setLoading(false);
    }
  }, [selectedProgramFilter, addToast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Set default creation program if available
  useEffect(() => {
    if (!createProgramId && programs.length > 0) {
      setCreateProgramId(programs[0].id);
    }
  }, [programs, createProgramId]);

  // Filtered assignments list
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (a.supervisee?.name?.toLowerCase().includes(q) ?? false) ||
        (a.supervisee?.email?.toLowerCase().includes(q) ?? false) ||
        (a.supervisor?.name?.toLowerCase().includes(q) ?? false) ||
        (a.supervisor?.email?.toLowerCase().includes(q) ?? false) ||
        (a.program?.name?.toLowerCase().includes(q) ?? false);

      const matchesProgram =
        selectedProgramFilter === "ALL" || a.programId === selectedProgramFilter;

      return matchesSearch && matchesProgram;
    });
  }, [assignments, searchQuery, selectedProgramFilter]);

  // Handle manual pairing creation
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProgramId || !createSuperviseeId || !createSupervisorId) {
      setFormMsg({ success: false, msg: "Please select a program, student, and supervisor." });
      return;
    }

    setCreating(true);
    setFormMsg(null);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: createProgramId,
          superviseeId: createSuperviseeId,
          supervisorId: createSupervisorId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateSuperviseeId("");
        setCreateSupervisorId("");
        setFormMsg({ success: true, msg: "Supervision match established successfully!" });
        addToast("success", "Supervision assignment created.");
        fetchAssignments();
        onRefreshData?.();
      } else {
        setFormMsg({ success: false, msg: data.error || "Failed to create assignment." });
        addToast("error", data.error || "Failed to create assignment.");
      }
    } catch (err: any) {
      setFormMsg({ success: false, msg: err.message || "Network error." });
      addToast("error", err.message || "Network error.");
    } finally {
      setCreating(false);
    }
  };

  // Handle reassigning supervisor
  const handleConfirmReassign = async () => {
    if (!reassignModal.assignment || !reassignModal.newSupervisorId) return;
    setReassignModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: reassignModal.assignment.id,
          newSupervisorId: reassignModal.newSupervisorId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "Supervisor reassigned successfully.");
        setReassignModal({ isOpen: false, assignment: null, newSupervisorId: "", loading: false });
        fetchAssignments();
        onRefreshData?.();
      } else {
        addToast("error", data.error || "Failed to reassign supervisor.");
        setReassignModal((prev) => ({ ...prev, loading: false }));
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
      setReassignModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Handle revoking assignment
  const handleConfirmRevoke = async () => {
    if (!revokeDialog.assignmentId) return;
    setRevokeDialog((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/assignments?assignmentId=${revokeDialog.assignmentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        addToast("info", "Supervision assignment revoked.");
        setRevokeDialog({ isOpen: false, assignmentId: null, superviseeName: "", programName: "", loading: false });
        fetchAssignments();
        onRefreshData?.();
      } else {
        addToast("error", data.error || "Failed to revoke assignment.");
        setRevokeDialog((prev) => ({ ...prev, loading: false }));
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
      setRevokeDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Manual Assignment Creator */}
      <Card className="shadow-sm border-border/60 max-w-4xl mx-auto w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] uppercase font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
              Manual Match
            </Badge>
          </div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-emerald-600" />
            Assign Supervisee to Supervisor
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Directly pair a student with a supervisor inside a program. Automatically handles program enrollment and pending request withdrawals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Program Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="assign-prog" className="text-xs font-semibold uppercase tracking-wide">
                  Program
                </Label>
                <Select value={createProgramId} onValueChange={(val) => val && setCreateProgramId(val)}>
                  <SelectTrigger id="assign-prog" className="text-xs">
                    <SelectValue placeholder="Select Program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name} ({p.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supervisee Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="assign-supervisee" className="text-xs font-semibold uppercase tracking-wide">
                  Supervisee (Student)
                </Label>
                <Select value={createSuperviseeId} onValueChange={(val) => val && setCreateSuperviseeId(val)}>
                  <SelectTrigger id="assign-supervisee" className="text-xs">
                    <SelectValue placeholder="Select Student" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisees.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supervisor Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="assign-supervisor" className="text-xs font-semibold uppercase tracking-wide">
                  Supervisor
                </Label>
                <Select value={createSupervisorId} onValueChange={(val) => val && setCreateSupervisorId(val)}>
                  <SelectTrigger id="assign-supervisor" className="text-xs">
                    <SelectValue placeholder="Select Supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formMsg && (
              <div
                className={`p-3 rounded-lg border text-xs font-medium ${
                  formMsg.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/25 text-destructive"
                }`}
              >
                {formMsg.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                )}
                {formMsg.msg}
              </div>
            )}

            <Button
              type="submit"
              disabled={creating || !createProgramId || !createSuperviseeId || !createSupervisorId}
              className="font-semibold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
              {creating ? "Assigning…" : "Establish Supervision Match"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Assignments Directory & Search */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                Matches ({filteredAssignments.length})
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold">Active Supervision Matches</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Review active student-supervisor pairings, reassign supervisors, or revoke assignments.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAssignments}
            className="text-xs font-semibold gap-1.5 shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student, supervisor, or program…"
                className="pl-8 text-xs h-9"
              />
            </div>
            <div className="w-full sm:w-64 shrink-0">
              <Select
                value={selectedProgramFilter}
                onValueChange={(val) => val && setSelectedProgramFilter(val)}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">
                    All Programs ({programs.length})
                  </SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignments Table / List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg space-y-2">
              <Users className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
              <p className="text-xs text-muted-foreground">
                No supervision assignments found matching your search.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
              {filteredAssignments.map((a) => (
                <div
                  key={a.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">
                        {a.supervisee?.name ?? "Supervisee"}
                      </p>
                      <span className="text-xs text-muted-foreground">paired with</span>
                      <p className="font-semibold text-sm text-primary">
                        {a.supervisor?.name ?? "Supervisor"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{a.supervisee?.email}</span>
                      <span>·</span>
                      <span className="font-mono">{a.supervisor?.email}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono bg-blue-50/60 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700/40">
                        {a.program?.name || "Program"}
                      </Badge>
                      {a.createdAt && (
                        <span className="text-[11px] text-muted-foreground">
                          Assigned: {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setReassignModal({
                          isOpen: true,
                          assignment: a,
                          newSupervisorId: a.supervisor?.id || "",
                          loading: false,
                        })
                      }
                      className="text-xs h-8 font-semibold"
                    >
                      Reassign
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setRevokeDialog({
                          isOpen: true,
                          assignmentId: a.id,
                          superviseeName: a.supervisee?.name || "Student",
                          programName: a.program?.name || "this program",
                          loading: false,
                        })
                      }
                      className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reassign Supervisor Modal */}
      {reassignModal.isOpen && reassignModal.assignment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="max-w-md w-full shadow-2xl border-border animate-in fade-in zoom-in-95">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <GitMerge className="h-4 w-4 text-primary" />
                Reassign Supervisor
              </CardTitle>
              <CardDescription className="text-xs">
                Switch supervisor for <strong>{reassignModal.assignment.supervisee?.name}</strong> in {reassignModal.assignment.program?.name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-sup" className="text-xs font-semibold">
                  New Supervisor
                </Label>
                <Select
                  value={reassignModal.newSupervisorId}
                  onValueChange={(val) =>
                    val && setReassignModal((prev) => ({ ...prev, newSupervisorId: val }))
                  }
                >
                  <SelectTrigger id="new-sup" className="text-xs">
                    <SelectValue placeholder="Select new supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name} ({s.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReassignModal({
                      isOpen: false,
                      assignment: null,
                      newSupervisorId: "",
                      loading: false,
                    })
                  }
                  disabled={reassignModal.loading}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmReassign}
                  disabled={
                    reassignModal.loading ||
                    !reassignModal.newSupervisorId ||
                    reassignModal.newSupervisorId === reassignModal.assignment.supervisor?.id
                  }
                  className="text-xs font-semibold"
                >
                  {reassignModal.loading ? "Reassigning…" : "Confirm Reassignment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revoke Assignment Confirmation Modal */}
      <ConfirmDialog
        isOpen={revokeDialog.isOpen}
        title="Revoke Supervision Match?"
        description={`Are you sure you want to unassign "${revokeDialog.superviseeName}" from ${revokeDialog.programName}? The student will be unlocked and able to apply to another supervisor.`}
        confirmText="Revoke Match"
        variant="danger"
        loading={revokeDialog.loading}
        onConfirm={handleConfirmRevoke}
        onCancel={() =>
          setRevokeDialog({
            isOpen: false,
            assignmentId: null,
            superviseeName: "",
            programName: "",
            loading: false,
          })
        }
      />
    </div>
  );
}
