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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface SupervisorReportItem {
  id: string;
  name: string;
  email: string;
  areasOfInterest: string[];
  studentCount: number;
  students: Array<{
    name: string;
    email: string;
    assignedDate: string;
    statement: string;
  }>;
}

const ROLE_STYLES: Record<string, { badge: string; row: string }> = {
  SUPERADMIN: {
    badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40",
    row: "border-l-4 border-l-violet-300 dark:border-l-violet-600",
  },
  ADMIN: {
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    row: "border-l-4 border-l-blue-300 dark:border-l-blue-600",
  },
  SUPERVISOR: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    row: "border-l-4 border-l-emerald-300 dark:border-l-emerald-600",
  },
  SUPERVISEE: {
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
    row: "border-l-4 border-l-amber-300 dark:border-l-amber-600",
  },
};

export default function AdminPortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("SUPERVISEE");
  const [createLoading, setCreateLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  const [userList, setUserList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const [allowedDomains, setAllowedDomains] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [enableGroupSupervision, setEnableGroupSupervision] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ success?: boolean; msg?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        if (data.user.role !== "ADMIN" && data.user.role !== "SUPERADMIN") {
          router.push(data.user.role === "SUPERVISOR" ? "/supervisor" : "/supervisee");
          return;
        }
        setCurrentUser(data.user);
      } else {
        router.push("/login?from=/admin");
      }
    } catch {
      router.push("/login?from=/admin");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setUserList(data.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setAllowedDomains(data.settings.ALLOWED_REGISTRATION_DOMAINS || "");
        setSmtpHost(data.settings.SMTP_HOST || "");
        setSmtpPort(data.settings.SMTP_PORT || "");
        setSmtpSecure(data.settings.SMTP_SECURE === "true");
        setSmtpUser(data.settings.SMTP_USER || "");
        setSmtpPass(data.settings.SMTP_PASS || "");
        setSmtpFromName(data.settings.SMTP_FROM_NAME || "");
        setSmtpFromEmail(data.settings.SMTP_FROM_EMAIL || "");
        setEnableGroupSupervision(data.settings.ENABLE_GROUP_SUPERVISION === "true");
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      if (currentUser.role === "SUPERADMIN") {
        fetchSettings();
      }
    }
  }, [currentUser, fetchUsers, fetchSettings]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateStatus(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateStatus({ success: true, msg: "User created successfully" });
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        fetchUsers();
      } else {
        setCreateStatus({ success: false, msg: data.error || "Failed to create user" });
      }
    } catch (err: any) {
      setCreateStatus({ success: false, msg: err.message || "Request failed" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "ALLOWED_REGISTRATION_DOMAINS", value: allowedDomains },
            { key: "SMTP_HOST", value: smtpHost },
            { key: "SMTP_PORT", value: smtpPort },
            { key: "SMTP_SECURE", value: smtpSecure ? "true" : "false" },
            { key: "SMTP_USER", value: smtpUser },
            { key: "SMTP_PASS", value: smtpPass },
            { key: "SMTP_FROM_NAME", value: smtpFromName },
            { key: "SMTP_FROM_EMAIL", value: smtpFromEmail },
            { key: "ENABLE_GROUP_SUPERVISION", value: enableGroupSupervision ? "true" : "false" },
          ]
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsStatus({ success: true, msg: "Settings saved successfully." });
      } else {
        setSettingsStatus({ success: false, msg: data.error || "Failed to save settings." });
      }
    } catch (err: any) {
      setSettingsStatus({ success: false, msg: err.message || "Request failed." });
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSettingsStatus(null), 3000);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const fetchReportData = async (): Promise<SupervisorReportItem[]> => {
    const res = await fetch("/api/admin/report");
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to fetch report data");
    }
    return data.report;
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const report = await fetchReportData();
      const headers = [
        "Supervisor Name",
        "Supervisor Email",
        "Areas of Interest",
        "Student Name",
        "Student Email",
        "Assigned Date",
        "Statement of Interest",
      ];
      const rows: string[][] = [];

      for (const sup of report) {
        const interests = sup.areasOfInterest.join("; ");
        if (sup.students.length === 0) {
          rows.push([
            sup.name,
            sup.email,
            `"${interests.replace(/"/g, '""')}"`,
            "No assigned students",
            "",
            "",
            "",
          ]);
        } else {
          for (const st of sup.students) {
            rows.push([
              sup.name,
              sup.email,
              `"${interests.replace(/"/g, '""')}"`,
              st.name,
              st.email,
              st.assignedDate,
              `"${st.statement.replace(/"/g, '""')}"`,
            ]);
          }
        }
      }

      const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-supervisors-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to export CSV");
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const report = await fetchReportData();
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginL = 50;
      const marginR = pageW - 50;
      const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

      if (report.length === 0) {
        doc.setFontSize(12);
        doc.text("No supervisors found in system.", marginL, 100);
      } else {
        report.forEach((sup, supIdx) => {
          if (supIdx > 0) {
            doc.addPage();
          }

          // Header block
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.text("STUDENT SUPERVISION APPLICATION — MASTER REPORT", marginL, 45);

          // Top divider
          doc.setDrawColor(0);
          doc.setLineWidth(1.5);
          doc.line(marginL, 52, marginR, 52);

          // Report title
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(`Supervisor ${supIdx + 1} of ${report.length}: ${sup.name}`, marginL, 76);

          // Sub-divider
          doc.setLineWidth(0.5);
          doc.line(marginL, 84, marginR, 84);

          // Metadata block
          const metaStartY = 100;
          const lineH = 16;
          const interests = sup.areasOfInterest.length > 0 ? sup.areasOfInterest.join(", ") : "General Supervision";

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("Supervisor Name:", marginL, metaStartY);
          doc.text("Email Address:", marginL, metaStartY + lineH);
          doc.text("Areas of Interest:", marginL, metaStartY + lineH * 2);
          doc.text("Date Generated:", marginL, metaStartY + lineH * 3);
          doc.text("Allocated Students:", marginL, metaStartY + lineH * 4);

          doc.setFont("helvetica", "normal");
          doc.text(sup.name, marginL + 115, metaStartY);
          doc.text(sup.email, marginL + 115, metaStartY + lineH);

          const interestLines = doc.splitTextToSize(interests, marginR - marginL - 120);
          doc.text(interestLines, marginL + 115, metaStartY + lineH * 2);
          const interestHeight = (interestLines.length - 1) * 12;

          doc.text(today, marginL + 115, metaStartY + lineH * 3 + interestHeight);
          doc.text(String(sup.studentCount), marginL + 115, metaStartY + lineH * 4 + interestHeight);

          const tableStartY = metaStartY + lineH * 5 + interestHeight + 10;

          // Section divider above table
          doc.setLineWidth(0.5);
          doc.line(marginL, tableStartY - 6, marginR, tableStartY - 6);

          if (sup.students.length === 0) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            doc.text("No allocated students for this supervisor.", marginL, tableStartY + 15);
          } else {
            autoTable(doc, {
              startY: tableStartY,
              margin: { left: marginL, right: 50 },
              head: [["#", "Student Name", "Student Email", "Assigned", "Statement of Interest"]],
              body: sup.students.map((st, i) => [
                String(i + 1),
                st.name,
                st.email,
                st.assignedDate,
                st.statement || "(no statement provided)",
              ]),
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
                0: { cellWidth: 22, halign: "center" },
                1: { cellWidth: 95 },
                2: { cellWidth: 125 },
                3: { cellWidth: 65, halign: "center" },
                4: { cellWidth: "auto" },
              },
            });
          }
        });
      }

      // Two-pass page footers for all pages
      const totalPages = doc.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(marginL, pageH - 38, marginR, pageH - 38);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);

        doc.text("Student Supervision Application — Admin Master Report", marginL, pageH - 24);
        doc.text(`Page ${pg} of ${totalPages}`, pageW / 2, pageH - 24, { align: "center" });
        doc.text("Confidential", marginR, pageH - 24, { align: "right" });

        doc.setTextColor(0);
      }

      doc.save(`admin-supervisors-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(err.message || "Failed to export PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const filteredUsers = userList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const counts = {
    total: userList.length,
    supervisees: userList.filter((u) => u.role === "SUPERVISEE").length,
    supervisors: userList.filter((u) => u.role === "SUPERVISOR").length,
    admins: userList.filter((u) => u.role === "ADMIN" || u.role === "SUPERADMIN").length,
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading Admin Portal…</p>
      </div>
    );
  }

  const roleStyle = ROLE_STYLES[currentUser.role] ?? ROLE_STYLES.ADMIN;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Home
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <span className="font-semibold text-sm">Admin Portal</span>
            <Badge variant="outline" className={`text-[10px] uppercase font-mono ${roleStyle.badge}`}>
              {currentUser.role}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {currentUser.name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs">
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">

        {/* Page title and Export Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">System Administration</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Provision accounts, manage user roles, and generate system reports.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="text-xs font-semibold"
            >
              {exportingCSV ? "Exporting..." : "↓ Export CSV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="text-xs font-semibold"
            >
              {exportingPDF ? "Exporting..." : "↓ Export PDF"}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Accounts", value: counts.total, cls: "border-l-4 border-l-primary/40" },
            { label: "Supervisees", value: counts.supervisees, cls: "border-l-4 border-l-amber-300 dark:border-l-amber-600" },
            { label: "Supervisors", value: counts.supervisors, cls: "border-l-4 border-l-emerald-300 dark:border-l-emerald-600" },
            { label: "Admins", value: counts.admins, cls: "border-l-4 border-l-violet-300 dark:border-l-violet-600" },
          ].map((s) => (
            <Card key={s.label} className={`shadow-sm ${s.cls}`}>
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs font-semibold uppercase">{s.label}</CardDescription>
                <CardTitle className="text-3xl font-extrabold">{s.value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Create user form */}
          <Card className="shadow-sm lg:col-span-1">
            <CardHeader className="pb-4">
              <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-primary border-primary/30 bg-primary/5 mb-1">
                Account Provisioning
              </Badge>
              <CardTitle className="text-base font-bold">Create User Account</CardTitle>
              <CardDescription className="text-xs">Register a new user in the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {createStatus && (
                <div className={`p-3 rounded-lg border text-xs font-medium ${
                  createStatus.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/25 text-destructive"
                }`}>
                  {createStatus.msg}
                </div>
              )}
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide">Full Name</Label>
                  <Input id="name" required value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="e.g. Jordan Miller" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide">Email Address</Label>
                  <Input id="email" type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="jordan@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pwd" className="text-xs font-semibold uppercase tracking-wide">Password</Label>
                  <Input id="pwd" type="password" required value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wide">Role</Label>
                  <Select value={newUserRole} onValueChange={(val) => val && setNewUserRole(val)}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPERVISEE">Supervisee</SelectItem>
                      <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      {currentUser.role === "SUPERADMIN" && (
                        <>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPERADMIN">SuperAdmin</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={createLoading} className="w-full font-semibold mt-1">
                  {createLoading ? "Creating…" : "+ Create User"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* User directory */}
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">User Directory</CardTitle>
                <CardDescription className="text-xs">{userList.length} registered accounts</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} className="text-xs shrink-0">
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email or role…"
                className="text-xs"
              />
              {loadingUsers ? (
                <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-lg">
                  No matching accounts found.
                </p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                  {filteredUsers.map((usr) => {
                    const s = ROLE_STYLES[usr.role] ?? { badge: "", row: "" };
                    return (
                      <div key={usr.id} className={`px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors ${s.row}`}>
                        <div className="space-y-0.5">
                          <div className="font-semibold text-sm">{usr.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{usr.email}</div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-mono font-semibold ${s.badge}`}>
                          {usr.role}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {currentUser.role === "SUPERADMIN" && (
          <div className="mt-6 grid grid-cols-1 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-destructive border-destructive/30 bg-destructive/5 mb-1">
                    SuperAdmin Only
                  </Badge>
                  <CardTitle className="text-base font-bold">System Settings</CardTitle>
                  <CardDescription className="text-xs">Configure global application settings and access controls.</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowSettings(!showSettings)} 
                  className="text-xs shrink-0"
                >
                  {showSettings ? "Hide Settings" : "Show Settings"}
                </Button>
              </CardHeader>
              
              {showSettings && (
                <CardContent className="space-y-4">
                  {settingsStatus && (
                    <div className={`p-3 rounded-lg border text-xs font-medium ${
                      settingsStatus.success
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700/40 dark:text-emerald-300"
                        : "bg-destructive/10 border-destructive/25 text-destructive"
                    }`}>
                      {settingsStatus.msg}
                    </div>
                  )}
                  <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                    
                    {/* Registration Settings */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold border-b pb-1">Registration Controls</h3>
                      <div className="space-y-1.5">
                        <Label htmlFor="allowedDomains" className="text-xs font-semibold uppercase tracking-wide">
                          Allowed Registration Domains
                        </Label>
                        <Input 
                          id="allowedDomains" 
                          value={allowedDomains} 
                          onChange={(e) => setAllowedDomains(e.target.value)} 
                          placeholder="example.com, test.edu (Leave blank for no restrictions)" 
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Comma-separated list of domains that are permitted to self-register via Email OTP.
                        </p>
                      </div>
                    </div>

                    {/* Features Settings */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold border-b pb-1">Features</h3>
                      <div className="space-y-1.5 pt-2">
                        <Label htmlFor="enableGroupSupervision" className="text-xs font-semibold uppercase tracking-wide">Enable Group Supervision</Label>
                        <Select value={enableGroupSupervision ? "true" : "false"} onValueChange={(val) => setEnableGroupSupervision(val === "true")}>
                          <SelectTrigger id="enableGroupSupervision">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Disabled</SelectItem>
                            <SelectItem value="true">Enabled</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Allow supervisees to form groups and apply for supervision collectively.
                        </p>
                      </div>
                    </div>

                    {/* SMTP Settings */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold border-b pb-1">SMTP Configuration</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="smtpHost" className="text-xs font-semibold uppercase tracking-wide">SMTP Host</Label>
                          <Input id="smtpHost" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="127.0.0.1" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="smtpPort" className="text-xs font-semibold uppercase tracking-wide">SMTP Port</Label>
                          <Input id="smtpPort" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="e.g. 587 or 2525" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="smtpUser" className="text-xs font-semibold uppercase tracking-wide">SMTP Username</Label>
                          <Input id="smtpUser" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="Leave blank if none" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="smtpPass" className="text-xs font-semibold uppercase tracking-wide">SMTP Password</Label>
                          <Input id="smtpPass" type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="Leave blank to keep unchanged" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="smtpFromName" className="text-xs font-semibold uppercase tracking-wide">Sender Name</Label>
                          <Input id="smtpFromName" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="Supervision App" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="smtpFromEmail" className="text-xs font-semibold uppercase tracking-wide">Sender Email</Label>
                          <Input id="smtpFromEmail" value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="noreply@example.com" />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <Label htmlFor="smtpSecure" className="text-xs font-semibold uppercase tracking-wide">Connection Security</Label>
                        <Select value={smtpSecure ? "true" : "false"} onValueChange={(val) => setSmtpSecure(val === "true")}>
                          <SelectTrigger id="smtpSecure">
                            <SelectValue placeholder="Select security" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="false">Standard / STARTTLS (Port 587/25)</SelectItem>
                            <SelectItem value="true">TLS / SSL (Port 465)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Use TLS/SSL for port 465. Use Standard for port 587 (NodeMailer upgrades to STARTTLS automatically).
                        </p>
                      </div>

                    </div>

                    <Button type="submit" disabled={savingSettings} className="font-semibold mt-4">
                      {savingSettings ? "Saving Settings…" : "Save All Settings"}
                    </Button>
                  </form>
                </CardContent>
              )}
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}
