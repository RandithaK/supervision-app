"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
  group?: {
    id: string;
    name: string;
    createdBy: { name: string } | null;
    members: { user: { name: string; email: string } }[];
  } | null;
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

  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        if (data.user.role !== "SUPERVISOR") {
          router.push(data.user.role === "ADMIN" || data.user.role === "SUPERADMIN" ? "/admin" : "/supervisee");
          return;
        }
        setCurrentUser(data.user);
        setInterestTags(Array.isArray(data.user.areasOfInterest) ? data.user.areasOfInterest : []);
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
      const [appRes, assignRes] = await Promise.all([fetch("/api/applications"), fetch("/api/assignments")]);
      const appData = await appRes.json();
      const assignData = await assignRes.json();
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

  // Save a specific tag list to the API immediately
  const saveTagsToAPI = async (tags: string[]) => {
    setUpdatingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/supervisor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areasOfInterest: tags }),
      });
      const data = await res.json();
      setProfileMsg(data.success
        ? { ok: true, text: "Saved." }
        : { ok: false, text: data.error ?? "Failed to save." });
      if (data.success) setTimeout(() => setProfileMsg(null), 2000);
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err.message });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleAddTag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTagInput.trim();
    if (!trimmed || interestTags.includes(trimmed)) return;
    const updated = [...interestTags, trimmed];
    setInterestTags(updated);
    setNewTagInput("");
    await saveTagsToAPI(updated);
  };

  const handleRemoveTag = async (tag: string) => {
    const updated = interestTags.filter((t) => t !== tag);
    setInterestTags(updated);
    await saveTagsToAPI(updated);
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
        setActionMessage({
          ok: true,
          text: status === "ACCEPTED"
            ? "Application accepted — supervisee assigned. Other pending applications withdrawn."
            : "Application rejected.",
        });
        fetchPortalData();
      } else {
        setActionMessage({ ok: false, text: data.error ?? "Action failed." });
      }
    } catch (err: any) {
      setActionMessage({ ok: false, text: err.message });
    }
  };

  // ── Export helpers ──────────────────────────────────────────────────────────

  /** Build enriched row data by joining assignments + accepted applications */
  const buildExportRows = () => {
    return assignments.map((a) => {
      const accepted = acceptedApps.find((app) => app.supervisee?.id === a.supervisee?.id);
      return {
        name:       a.supervisee?.name   ?? "—",
        email:      a.supervisee?.email  ?? "—",
        assigned:   new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        statement:  accepted?.message   ?? "(no statement provided)",
      };
    });
  };

  const handleExportCSV = () => {
    const rows = buildExportRows();
    const headers = ["Name", "Email", "Assigned Date", "Statement of Interest"];
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [r.name, r.email, r.assigned, `"${r.statement.replace(/"/g, '""')}"`].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `supervisees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { jsPDF }  = await import("jspdf");
    const autoTable  = (await import("jspdf-autotable")).default;

    const doc        = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const rows       = buildExportRows();
    const pageW      = doc.internal.pageSize.getWidth();
    const pageH      = doc.internal.pageSize.getHeight();
    const marginL    = 50;
    const marginR    = pageW - 50;
    const supervisor = currentUser?.name ?? "Supervisor";
    const interests  = interestTags.length > 0 ? interestTags.join(", ") : "General Supervision";
    const today      = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

    // ── Header block ────────────────────────────────────────────────────────
    // Institution / app name — small caps feel
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("STUDENT SUPERVISION APPLICATION", marginL, 45);

    // Top divider
    doc.setDrawColor(0);
    doc.setLineWidth(1.5);
    doc.line(marginL, 52, marginR, 52);

    // Report title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Supervision Assignment Report", marginL, 76);

    // Sub-divider
    doc.setLineWidth(0.5);
    doc.line(marginL, 84, marginR, 84);

    // Metadata block
    const metaStartY = 100;
    const lineH      = 17;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Supervisor:",          marginL,      metaStartY);
    doc.text("Areas of Interest:",   marginL,      metaStartY + lineH);
    doc.text("Date Generated:",      marginL,      metaStartY + lineH * 2);
    doc.text("Total Students:",      marginL,      metaStartY + lineH * 3);

    doc.setFont("helvetica", "normal");
    doc.text(supervisor,             marginL + 110, metaStartY);
    // Wrap interests to fit page width
    const interestLines = doc.splitTextToSize(interests, marginR - marginL - 115);
    doc.text(interestLines,          marginL + 110, metaStartY + lineH);
    const interestHeight = interestLines.length * 12;
    doc.text(today,                  marginL + 110, metaStartY + lineH * 2 + (interestHeight - 12));
    doc.text(String(rows.length),    marginL + 110, metaStartY + lineH * 3 + (interestHeight - 12));

    const tableStartY = metaStartY + lineH * 4 + interestHeight + 10;

    // Section divider above table
    doc.setLineWidth(0.5);
    doc.line(marginL, tableStartY - 6, marginR, tableStartY - 6);

    // ── Table ───────────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginL, right: 50 },
      head: [["#", "Name", "Email", "Assigned", "Statement of Interest"]],
      body: rows.map((r, i) => [
        String(i + 1),
        r.name,
        r.email,
        r.assigned,
        r.statement,
      ]),
      // Strict B&W styles
      headStyles: {
        fillColor: false as any,
        textColor: 0,
        fontStyle: "bold",
        fontSize: 8.5,
        lineColor: 0,
        lineWidth: 0.5,
      },
      bodyStyles: {
        fillColor: false as any,
        textColor: 0,
        fontSize: 8.5,
        lineColor: 180,
        lineWidth: 0.3,
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240] as any,
      },
      styles: {
        overflow: "linebreak",
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" },  // #
        1: { cellWidth: 100 },                    // Name
        2: { cellWidth: 130 },                    // Email
        3: { cellWidth: 65,  halign: "center" },  // Assigned
        4: { cellWidth: "auto" },                 // Statement
      },
    });

    // ── Two-pass page footers ────────────────────────────────────────────────
    // After generating all pages we know the total count.
    const totalPages = doc.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
      doc.setPage(pg);

      // Footer rule
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(marginL, pageH - 38, marginR, pageH - 38);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);

      // Left: app name
      doc.text("Student Supervision Application", marginL, pageH - 24);
      // Centre: page X of Y
      doc.text(`Page ${pg} of ${totalPages}`, pageW / 2, pageH - 24, { align: "center" });
      // Right: confidential
      doc.text("Confidential", marginR, pageH - 24, { align: "right" });

      doc.setTextColor(0);
    }

    doc.save(`supervision-report-${new Date().toISOString().slice(0, 10)}.pdf`);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading Supervisor Portal…</p>
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
            <span className="font-semibold text-sm">Supervisor Portal</span>
            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40">
              SUPERVISOR
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
          <h1 className="text-2xl font-extrabold tracking-tight">Supervisor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set your areas of interest, review incoming applications, and manage assigned students.
          </p>
        </div>

        <Separator />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-l-4 border-l-amber-300 dark:border-l-amber-600 bg-amber-50/50 dark:bg-amber-900/10">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">Pending Requests</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-amber-700 dark:text-amber-300">{pendingApps.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">Awaiting your decision</p>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-300 dark:border-l-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">Accepted</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">{acceptedApps.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{assignments.length} student{assignments.length !== 1 ? "s" : ""} assigned</p>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-red-300 dark:border-l-red-600 bg-red-50/50 dark:bg-red-900/10">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase text-red-700 dark:text-red-400">Rejected</CardDescription>
              <CardTitle className="text-3xl font-extrabold text-red-700 dark:text-red-300">{rejectedApps.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">Applications declined</p>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-primary/40">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase">Areas of Interest</CardDescription>
              <CardTitle className="text-3xl font-extrabold">{interestTags.length}</CardTitle>
              <p className="text-[11px] text-muted-foreground">Topic{interestTags.length !== 1 ? "s" : ""} listed</p>
            </CardHeader>
          </Card>
        </div>

        {/* Areas of Interest */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-primary border-primary/30 bg-primary/5 mb-1">My Profile</Badge>
            <CardTitle className="text-base font-bold">Areas of Interest</CardTitle>
            <CardDescription className="text-xs">Add topics so supervisees can discover and filter you by interest.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current tags */}
            <div className="space-y-2">
              {interestTags.length === 0 ? (
                <p className="text-xs text-muted-foreground italic border border-dashed rounded-lg p-3">
                  No topics added yet. Type a topic below and press Enter.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interestTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/40 flex items-center gap-2">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        disabled={updatingProfile}
                        className="text-emerald-400 hover:text-destructive transition-colors font-bold disabled:opacity-40"
                        title={`Remove "${tag}"`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Inline save status */}
              {profileMsg && (
                <p className={`text-[11px] font-medium ${
                  profileMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}>
                  {profileMsg.ok ? "✓" : "✗"} {profileMsg.text}
                </p>
              )}
            </div>

            {/* Add tag */}
            <form onSubmit={handleAddTag} className="flex gap-2">
              <Input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="e.g. Cognitive Behavioral Therapy…"
                className="text-xs flex-1"
                disabled={updatingProfile}
              />
              <Button type="submit" variant="secondary" size="sm" className="font-semibold text-xs shrink-0" disabled={updatingProfile}>
                {updatingProfile ? "…" : "+ Add"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Action message */}
        {actionMessage && (
          <div className={`p-4 rounded-lg border text-xs font-semibold ${
            actionMessage.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/25 text-destructive"
          }`}>
            {actionMessage.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pending applications queue */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40 mb-1">
                  Incoming
                </Badge>
                <CardTitle className="text-base font-bold">Pending Requests</CardTitle>
                <CardDescription className="text-xs">Applications awaiting your accept / reject decision.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchPortalData} className="text-xs shrink-0">
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingData ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
              ) : pendingApps.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                  No pending requests. All caught up! 🎉
                </p>
              ) : (
                <div className="rounded-lg border border-amber-200 dark:border-amber-700/40 overflow-hidden divide-y divide-amber-100 dark:divide-amber-900/30">
                  {pendingApps.map((app) => (
                    <div key={app.id} className="p-4 space-y-3 bg-amber-50/50 dark:bg-amber-900/10">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">
                            {app.group ? `${app.group.name} (Group)` : (app.supervisee?.name ?? "Supervisee")}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {app.group ? (
                              <span>Applied by {app.group.createdBy?.name || "Leader"}</span>
                            ) : (
                              app.supervisee?.email
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {app.group && (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono bg-blue-100 text-blue-700 border-blue-200">
                              GROUP
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] uppercase font-mono bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40">
                            Pending
                          </Badge>
                        </div>
                      </div>
                      {app.group && app.group.members && (
                        <div className="bg-blue-50/50 p-2 rounded text-xs border border-blue-100">
                          <p className="font-semibold mb-1 text-blue-800">Group Members ({app.group.members.length}):</p>
                          <ul className="list-disc list-inside text-blue-700 space-y-0.5">
                            {app.group.members.map((m, i) => (
                              <li key={i}>{m.user.name} <span className="text-muted-foreground ml-1 font-mono text-[10px]">{m.user.email}</span></li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {app.message && (
                        <p className="text-xs text-muted-foreground bg-background p-2.5 rounded border border-border italic">
                          &ldquo;{app.message}&rdquo;
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplicationAction(app.id, "ACCEPTED")}
                          className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        >
                          Accept &amp; Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleApplicationAction(app.id, "REJECTED")}
                          className="flex-1 text-xs font-semibold"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* History */}
              {(acceptedApps.length > 0 || rejectedApps.length > 0) && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wide">History</p>
                  <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                    {[...acceptedApps, ...rejectedApps].map((app) => (
                      <div key={app.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                        <span className="font-medium">
                          {app.group ? `${app.group.name} (Group)` : (app.supervisee?.name ?? "Supervisee")}
                        </span>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono ${
                          app.status === "ACCEPTED"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40"
                            : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40"
                        }`}>
                          {app.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned supervisees */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40 mb-1">
                    Active Students
                  </Badge>
                  <CardTitle className="text-base font-bold">Assigned Supervisees</CardTitle>
                  <CardDescription className="text-xs">Supervisees currently assigned to you.</CardDescription>
                </div>
                {assignments.length > 0 && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="text-xs font-semibold"
                    >
                      ↓ CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportPDF}
                      className="text-xs font-semibold"
                    >
                      ↓ PDF
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                  No supervisees assigned yet. Accept an application to assign a student.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                  {assignments.map((a) => {
                    const accepted = acceptedApps.find((app) => app.supervisee?.id === a.supervisee?.id);
                    return (
                      <div key={a.id} className="px-4 py-3 flex items-center justify-between border-l-4 border-l-emerald-300 dark:border-l-emerald-600">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-sm">{a.supervisee?.name ?? "Supervisee"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{a.supervisee?.email}</p>
                          {accepted?.message && (
                            <p className="text-[11px] text-muted-foreground italic truncate max-w-xs">
                              &ldquo;{accepted.message}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[10px] font-mono bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40">
                            Assigned
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
