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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Supervisor {
  id: string;
  name: string;
  email: string;
  areasOfInterest?: string[] | null;
}

interface Application {
  id: string;
  message?: string;
  status: string;
  createdAt: string;
  supervisor: { id: string; name: string; email: string; areasOfInterest?: string[] | null } | null;
}

interface Assignment {
  id: string;
  supervisor: { id: string; name: string; email: string } | null;
}

function statusStyle(status: string) {
  if (status === "ACCEPTED") return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40";
  if (status === "REJECTED") return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40";
  if (status === "WITHDRAWN") return "bg-muted text-muted-foreground border-border";
  return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40";
}

export default function SuperviseePortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null);
  const [appMessage, setAppMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

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

  const fetchPortalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [superRes, appRes, assignRes] = await Promise.all([
        fetch("/api/supervisors"),
        fetch("/api/applications"),
        fetch("/api/assignments"),
      ]);
      const superData = await superRes.json();
      const appData = await appRes.json();
      const assignData = await assignRes.json();
      if (superData.success) setSupervisors(superData.supervisors);
      if (appData.success) setApplications(appData.applications);
      if (assignData.success) setAssignments(assignData.assignments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { fetchSession(); }, [fetchSession]);
  useEffect(() => { if (currentUser) fetchPortalData(); }, [currentUser, fetchPortalData]);

  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    supervisors.forEach((s) => {
      if (Array.isArray(s.areasOfInterest)) s.areasOfInterest.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
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
    if (!selectedSupervisor) return;
    setSubmitting(true);
    setSubmitStatus(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supervisorId: selectedSupervisor.id, message: appMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus({ success: true, msg: `Application to ${selectedSupervisor.name} submitted!` });
        setAppMessage("");
        setSelectedSupervisor(null);
        fetchPortalData();
      } else {
        setSubmitStatus({ success: false, msg: data.error || "Failed to submit application" });
      }
    } catch (err: any) {
      setSubmitStatus({ success: false, msg: err.message || "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const activeAssignment = assignments[0];
  const assignedSupervisor = activeAssignment?.supervisor;

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
            Browse supervisors, filter by interest, and apply for supervision.
          </p>
        </div>

        <Separator />

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

        {/* Application form (shown when a supervisor is selected) */}
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
                <Button type="submit" disabled={submitting} className="font-semibold text-xs">
                  {submitting ? "Submitting…" : "Submit Application →"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Supervisor directory */}
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-primary border-primary/30 bg-primary/5 mb-1">
                    Directory ({supervisors.length})
                  </Badge>
                  <CardTitle className="text-base font-bold">All Supervisors</CardTitle>
                  <CardDescription className="text-xs">Filter by area of interest or search by name.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchPortalData} className="text-xs shrink-0">
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
                                variant="outline"
                                onClick={() => setSelectedTagFilter(tag)}
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
              <CardDescription className="text-xs">Track all your submitted supervision requests.</CardDescription>
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
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono shrink-0 ${statusStyle(app.status)}`}>
                          {app.status}
                        </Badge>
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
      </main>
    </div>
  );
}
