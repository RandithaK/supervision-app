"use client";

import { useState, useEffect, useCallback } from "react";
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
  areasOfInterest?: string[] | null;
}

interface Application {
  id: string;
  message?: string;
  status: string;
  createdAt: string;
  supervisee: { id: string; name: string; email: string } | null;
}

interface Assignment {
  id: string;
  supervisee: { id: string; name: string; email: string } | null;
  createdAt: string;
}

export default function SupervisorPortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Supervisor Profile: Areas of Interest Array state
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Real backend data state
  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        if (data.user.role !== "SUPERVISOR") {
          const target =
            data.user.role === "ADMIN" || data.user.role === "SUPERADMIN"
              ? "/admin"
              : "/supervisee";
          router.push(target);
          return;
        }
        setCurrentUser(data.user);
        setInterestTags(
          Array.isArray(data.user.areasOfInterest) ? data.user.areasOfInterest : []
        );
      } else {
        router.push("/login?from=/supervisor");
      }
    } catch {
      router.push("/login?from=/supervisor");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchPortalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [appRes, assignRes] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/assignments"),
      ]);
      const appData = await appRes.json();
      const assignData = await assignRes.json();

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

  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTagInput.trim();
    if (trimmed && !interestTags.includes(trimmed)) {
      setInterestTags([...interestTags, trimmed]);
      setNewTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setInterestTags(interestTags.filter((t) => t !== tagToRemove));
  };

  const handleSaveProfile = async () => {
    setUpdatingProfile(true);
    setProfileMsg(null);

    try {
      const res = await fetch("/api/supervisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areasOfInterest: interestTags }),
      });

      const data = await res.json();
      if (data.success) {
        setProfileMsg("Areas of interest updated successfully!");
        setTimeout(() => setProfileMsg(null), 3000);
      } else {
        setProfileMsg(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setProfileMsg(`Network error: ${err.message}`);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleApplicationAction = async (applicationId: string, status: "ACCEPTED" | "REJECTED") => {
    setActionMessage(null);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, status }),
      });

      const data = await res.json();
      if (data.success) {
        if (status === "ACCEPTED") {
          setActionMessage(
            `Application ACCEPTED! Supervisee is now assigned to you. All other pending applications for this supervisee were automatically WITHDRAWN.`
          );
        } else {
          setActionMessage("Application REJECTED.");
        }
        fetchPortalData();
      } else {
        setActionMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Network error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const pendingApps  = applications.filter((a) => a.status === "PENDING");
  const acceptedApps = applications.filter((a) => a.status === "ACCEPTED");
  const rejectedApps = applications.filter((a) => a.status === "REJECTED");

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground animate-pulse">Loading Supervisor Portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-semibold text-xs text-muted-foreground hover:text-foreground">
              &larr; Home
            </Link>
            <span className="text-border">|</span>
            <span className="font-bold text-base">Supervisor Portal</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
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
          <h1 className="text-3xl font-extrabold tracking-tight">Supervisor Management Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Specify your areas of interest, review incoming supervisee applications, and manage assigned students.
          </p>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-amber-500/30 bg-amber-500/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold text-amber-400">Pending Requests</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-amber-400">{pendingApps.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">Awaiting your decision</p>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold text-emerald-400">Accepted</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-emerald-400">{acceptedApps.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{assignments.length} student{assignments.length !== 1 ? "s" : ""} assigned</p>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-destructive/30 bg-destructive/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold text-destructive">Rejected</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-destructive">{rejectedApps.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">Applications declined</p>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Areas of Interest</CardDescription>
              <CardTitle className="text-3xl font-extrabold">{interestTags.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">Topic{interestTags.length !== 1 ? "s" : ""} listed</p>
            </CardHeader>
          </Card>
        </div>

        {/* Areas of Interest Profile Form (Tag Add / Remove) */}
        <Card className="shadow-lg border-border">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="w-fit text-xs text-emerald-400 border-emerald-500/30 uppercase font-mono mb-1">
              My Profile
            </Badge>
            <CardTitle className="text-xl font-bold">Specify Areas of Interest (Array)</CardTitle>
            <CardDescription className="text-xs">
              Easily add and remove topics of expertise for supervisee matching.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {profileMsg && (
              <div className="p-3 rounded-xl border bg-emerald-950/40 border-emerald-800/50 text-emerald-300 text-xs font-medium">
                {profileMsg}
              </div>
            )}

            {/* Current Tags List */}
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Current Interest Topics ({interestTags.length})</Label>
              {interestTags.length === 0 ? (
                <div className="text-xs text-muted-foreground italic border border-dashed rounded-xl p-3">
                  No areas of interest added yet. Type a topic below and click + Add.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interestTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="px-3 py-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-2 group"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-emerald-400/70 hover:text-destructive font-bold text-sm ml-1 transition"
                        title={`Remove "${tag}"`}
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Tag Input */}
            <form onSubmit={handleAddTag} className="flex gap-2">
              <Input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="e.g. Cognitive Behavioral Therapy, Clinical Psychology..."
                className="text-xs flex-1"
              />
              <Button type="submit" variant="secondary" size="sm" className="font-semibold text-xs">
                + Add Interest
              </Button>
            </form>

            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                type="button"
                onClick={handleSaveProfile}
                disabled={updatingProfile}
                className="font-semibold text-xs px-6"
              >
                {updatingProfile ? "Saving Profile..." : "Save Areas of Interest"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="p-4 rounded-xl border bg-primary/10 border-primary/30 text-primary text-xs font-semibold">
            {actionMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Incoming Applications Queue */}
          <Card className="shadow-lg border-border">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <Badge variant="outline" className="w-fit text-xs text-amber-400 border-amber-500/30 uppercase font-mono mb-1">
                  Incoming Requests
                </Badge>
                <CardTitle className="text-lg font-bold">Supervision Applications</CardTitle>
                <CardDescription className="text-xs">
                  Accept or reject supervisee requests.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchPortalData} className="text-xs">
                Refresh
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {loadingData ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Loading applications...</div>
              ) : pendingApps.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                  No pending requests. All caught up! 🎉
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                  {pendingApps.map((app) => (
                    <div key={app.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-sm">
                            {app.supervisee ? app.supervisee.name : "Supervisee"}
                          </span>
                          <div className="text-xs text-muted-foreground font-mono">
                            {app.supervisee?.email}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono bg-amber-500/15 text-amber-400 border-amber-500/30"
                        >
                          PENDING
                        </Badge>
                      </div>

                      {app.message && (
                        <p className="text-xs text-muted-foreground bg-background p-2 rounded border border-border">
                          &ldquo;{app.message}&rdquo;
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleApplicationAction(app.id, "ACCEPTED")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex-1"
                        >
                          Accept &amp; Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleApplicationAction(app.id, "REJECTED")}
                          className="text-xs font-semibold flex-1"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Application History: accepted + rejected */}
              {(acceptedApps.length > 0 || rejectedApps.length > 0) && (
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide">History</p>
                  <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
                    {[...acceptedApps, ...rejectedApps].map((app) => (
                      <div key={app.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {app.supervisee ? app.supervisee.name : "Supervisee"}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono ${
                            app.status === "ACCEPTED"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-destructive/15 text-destructive border-destructive/30"
                          }`}
                        >
                          {app.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Supervisees Directory */}
          <Card className="shadow-lg border-border">
            <CardHeader className="pb-4">
              <Badge variant="outline" className="w-fit text-xs text-emerald-400 border-emerald-500/30 uppercase font-mono mb-1">
                Active Students
              </Badge>
              <CardTitle className="text-lg font-bold">My Assigned Supervisees</CardTitle>
              <CardDescription className="text-xs">
                Supervisees currently assigned to you for supervision.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {assignments.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                  No supervisees assigned yet. Accept an application above to assign a student.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
                  {assignments.map((a) => (
                    <div key={a.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-sm">{a.supervisee ? a.supervisee.name : "Supervisee"}</div>
                        <div className="text-muted-foreground font-mono">{a.supervisee?.email}</div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
                        Active Supervisee
                      </Badge>
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
