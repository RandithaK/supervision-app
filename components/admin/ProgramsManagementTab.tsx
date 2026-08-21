"use client";

import React, { useState } from "react";
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
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { ProgramInfo } from "@/types/portal";

interface ProgramsManagementTabProps {
  programs: ProgramInfo[];
  loading: boolean;
  onRefresh: () => void;
  onCreateProgram: (data: { name: string; description: string; status: string }) => Promise<boolean>;
  onUpdateStatus: (programId: string, newStatus: string) => Promise<void>;
}

export function ProgramsManagementTab({
  programs,
  loading,
  onRefresh,
  onCreateProgram,
  onUpdateStatus,
}: ProgramsManagementTabProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [creating, setCreating] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ success?: boolean; msg?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setFormFeedback(null);
    try {
      const ok = await onCreateProgram({ name, description, status });
      if (ok) {
        setName("");
        setDescription("");
        setStatus("ACTIVE");
        setFormFeedback({ success: true, msg: "Program created successfully!" });
      } else {
        setFormFeedback({ success: false, msg: "Failed to create program." });
      }
    } catch (err: any) {
      setFormFeedback({ success: false, msg: err.message || "An error occurred." });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Program Form */}
      <Card className="shadow-sm border-border/60 max-w-3xl mx-auto w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] uppercase font-mono text-blue-600 border-blue-500/30 bg-blue-500/10">
              Create
            </Badge>
          </div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Create New Program
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Programs organize supervision — supervisors and supervisees join programs to connect.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="prog-name" className="text-xs font-semibold uppercase tracking-wide">
                Program Name
              </Label>
              <Input
                id="prog-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CBT Supervision 2026"
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog-desc" className="text-xs font-semibold uppercase tracking-wide">
                Description <span className="text-muted-foreground normal-case tracking-normal">(optional)</span>
              </Label>
              <Input
                id="prog-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this program..."
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog-status" className="text-xs font-semibold uppercase tracking-wide">
                Initial Status
              </Label>
              <Select value={status} onValueChange={(val) => val && setStatus(val)}>
                <SelectTrigger id="prog-status" className="text-xs">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE" className="text-xs">Active — visible to all</SelectItem>
                  <SelectItem value="DRAFT" className="text-xs">Draft — visible to supervisors only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs font-medium ${
                  formFeedback.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/25 text-destructive"
                }`}
              >
                {formFeedback.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                )}
                {formFeedback.msg}
              </div>
            )}

            <Button type="submit" disabled={creating || !name.trim()} className="font-semibold text-xs gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
              {creating ? "Creating…" : "Create Program"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Program List */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10 mb-1">
              All Programs
            </Badge>
            <CardTitle className="text-lg font-bold">Program Directory</CardTitle>
            <CardDescription className="text-xs mt-0.5">Manage program lifecycle and participant visibility.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="text-xs font-semibold gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : programs.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg space-y-2">
              <Globe className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
              <p className="text-xs text-muted-foreground">No programs created yet. Create one above.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
              {programs.map((prog) => {
                const statusColor =
                  prog.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : prog.status === "DRAFT"
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-muted text-muted-foreground border-border";
                return (
                  <div key={prog.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{prog.name}</p>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${statusColor}`}>
                          {prog.status}
                        </Badge>
                      </div>
                      {prog.description && (
                        <p className="text-xs text-muted-foreground">{prog.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {prog.supervisorCount} supervisor{prog.supervisorCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {prog.superviseeCount} supervisee{prog.superviseeCount !== 1 ? "s" : ""}
                        </span>
                        <span>Created by {prog.createdBy?.name || "Admin"}</span>
                        <span>{new Date(prog.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {prog.status === "DRAFT" && (
                        <Button size="sm" onClick={() => onUpdateStatus(prog.id, "ACTIVE")} className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white h-7">
                          Activate
                        </Button>
                      )}
                      {prog.status === "ACTIVE" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => onUpdateStatus(prog.id, "DRAFT")} className="text-xs h-7">
                            Draft
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onUpdateStatus(prog.id, "ARCHIVED")} className="text-xs text-amber-600 border-amber-200 hover:bg-amber-50 h-7">
                            Archive
                          </Button>
                        </>
                      )}
                      {prog.status === "ARCHIVED" && (
                        <Button size="sm" variant="outline" onClick={() => onUpdateStatus(prog.id, "ACTIVE")} className="text-xs h-7">
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
