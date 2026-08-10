"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function SuperviseePortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Real backend data state
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Filter state: selected area of interest tag & text search query
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Application submission modal/form state
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
          const target =
            data.user.role === "ADMIN" || data.user.role === "SUPERADMIN"
              ? "/admin"
              : "/supervisor";
          router.push(target);
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

      if (superData.success) {
        setSupervisors(superData.supervisors);
      }
      if (appData.success) {
        setApplications(appData.applications);
      }
      if (assignData.success) {
        setAssignments(assignData.assignments);
      }
    } catch (err) {
      console.error("Failed to fetch portal data:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (currentUser) {
      fetchPortalData();
    }
  }, [currentUser, fetchPortalData]);

  // Extract all unique interest tags across all supervisors for tag filtering
  const allAvailableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    supervisors.forEach((s) => {
      if (Array.isArray(s.areasOfInterest)) {
        s.areasOfInterest.forEach((tag) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [supervisors]);

  // Filter supervisors by selected tag and search text
  const filteredSupervisors = useMemo(() => {
    return supervisors.filter((s) => {
      const matchesSearch =
        searchQuery === "" ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(s.areasOfInterest) &&
          s.areasOfInterest.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

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
        body: JSON.stringify({
          supervisorId: selectedSupervisor.id,
          message: appMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitStatus({
          success: true,
          msg: `Application to ${selectedSupervisor.name} submitted successfully!`,
        });
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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground animate-pulse">Loading Supervisee Portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold text-xs text-muted-foreground hover:text-foreground">
              &larr; Home
            </Link>
            <span className="text-border">|</span>
            <span className="font-bold text-base">Supervisee Portal</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold bg-amber-500/15 text-amber-400 border-amber-500/30">
              {currentUser.role}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Welcome, <strong className="text-foreground">{currentUser.name}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs font-semibold">
              Log Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
        
        {/* Banner */}
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight">Supervision Application Portal</h1>
          <p className="text-muted-foreground text-sm">
            Explore the complete directory of supervisors, filter by areas of interest, and apply for supervision.
          </p>
        </div>

        {/* Supervision Status Card */}
        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3">
            <Badge variant="outline" className="w-fit text-xs text-emerald-400 border-emerald-500/30 uppercase font-mono mb-1">
              Supervision Assignment Status
            </Badge>
            <CardTitle className="text-xl font-bold">
              {assignedSupervisor ? (
                <span>Assigned to <span className="text-emerald-400">{assignedSupervisor.name}</span></span>
              ) : (
                <span className="text-amber-400">Not Yet Assigned</span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {assignedSupervisor
                ? `You have an accepted supervision assignment with ${assignedSupervisor.email}.`
                : "Browse supervisors below, filter by interest, and submit your application."}
            </CardDescription>
          </CardHeader>
        </Card>

        {submitStatus && (
          <div className={`p-4 rounded-xl border text-xs font-medium ${submitStatus.success ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300" : "bg-destructive/15 border-destructive/30 text-destructive"}`}>
            {submitStatus.msg}
          </div>
        )}

        {/* Application Form */}
        {selectedSupervisor && (
          <Card className="shadow-xl border-primary/50 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold">
                  Apply for Supervision to {selectedSupervisor.name}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSupervisor(null)} className="text-xs">
                  Cancel
                </Button>
              </div>
              <CardDescription className="text-xs">
                Supervisor Email: <strong className="text-foreground">{selectedSupervisor.email}</strong>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <form onSubmit={handleApply} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Application Message / Statement of Interest</Label>
                  <textarea
                    rows={3}
                    value={appMessage}
                    onChange={(e) => setAppMessage(e.target.value)}
                    placeholder="Describe your goals and why you wish to be supervised by this doctor..."
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>

                <Button type="submit" disabled={submitting} className="font-semibold text-xs">
                  {submitting ? "Submitting Application..." : "Submit Supervision Application"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Complete Supervisors Directory & Interactive Filter */}
          <Card className="shadow-lg border-border lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <Badge variant="outline" className="w-fit text-xs text-primary border-primary/30 uppercase font-mono mb-1">
                    Supervisor Directory ({supervisors.length} Total)
                  </Badge>
                  <CardTitle className="text-xl font-bold">Complete List of Supervisors</CardTitle>
                  <CardDescription className="text-xs">
                    Browse all available supervisors and filter by area of interest.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchPortalData} className="text-xs">
                  Refresh List
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              
              {/* Search & Tag Filter controls */}
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground font-semibold">Search Supervisors</Label>
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by supervisor name, email, or area of interest..."
                    className="text-xs"
                  />
                </div>

                {/* Quick Area of Interest Filter Buttons */}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground font-semibold">Filter by Area of Interest Tag</Label>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant={selectedTagFilter === "ALL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTagFilter("ALL")}
                      className="text-xs h-7 px-3 font-semibold"
                    >
                      All Supervisors ({supervisors.length})
                    </Button>
                    {allAvailableTags.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        variant={selectedTagFilter === tag ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTagFilter(tag)}
                        className="text-xs h-7 px-3 font-semibold"
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Complete Supervisors List */}
              {loadingData ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Loading supervisors...</div>
              ) : filteredSupervisors.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl space-y-2">
                  <p>No supervisors match the selected filter criteria.</p>
                  {(selectedTagFilter !== "ALL" || searchQuery) && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setSelectedTagFilter("ALL");
                        setSearchQuery("");
                      }}
                      className="text-xs font-semibold text-primary"
                    >
                      Reset Filters & View All
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                  {filteredSupervisors.map((s) => (
                    <div key={s.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/30 transition">
                      <div className="space-y-2">
                        <div>
                          <div className="font-bold text-sm text-foreground">{s.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{s.email}</div>
                        </div>

                        {/* Areas of Interest Tags */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {Array.isArray(s.areasOfInterest) && s.areasOfInterest.length > 0 ? (
                            s.areasOfInterest.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                onClick={() => setSelectedTagFilter(tag)}
                                className={`text-[11px] cursor-pointer transition ${
                                  selectedTagFilter === tag
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
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

                      <div className="pt-2 sm:pt-0">
                        {assignedSupervisor ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Already Assigned
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setSelectedSupervisor(s)}
                            className="text-xs font-semibold"
                          >
                            Apply for Supervision &rarr;
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Applications History */}
          <Card className="shadow-lg border-border lg:col-span-1">
            <CardHeader className="pb-4">
              <Badge variant="outline" className="w-fit text-xs text-amber-400 border-amber-500/30 uppercase font-mono mb-1">
                My Applications
              </Badge>
              <CardTitle className="text-lg font-bold">Application Status</CardTitle>
              <CardDescription className="text-xs">
                Status of all submitted supervision requests.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {applications.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                  No applications submitted yet.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
                  {applications.map((app) => (
                    <div key={app.id} className="p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">
                          {app.supervisor ? app.supervisor.name : "Supervisor"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono ${
                            app.status === "ACCEPTED"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : app.status === "REJECTED"
                              ? "bg-destructive/15 text-destructive border-destructive/30"
                              : app.status === "WITHDRAWN"
                              ? "bg-muted text-muted-foreground border-border"
                              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          }`}
                        >
                          {app.status}
                        </Badge>
                      </div>

                      {app.message && (
                        <p className="text-muted-foreground text-[11px] truncate">"{app.message}"</p>
                      )}

                      {app.status === "WITHDRAWN" && (
                        <p className="text-[10px] text-muted-foreground font-mono">
                          Auto-withdrawn because another supervisor accepted your supervision request.
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
