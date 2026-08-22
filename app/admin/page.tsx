"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { generateAdminPDFReport, type SupervisorReportItem } from "@/lib/pdf/admin-pdf-report";
import { useToast } from "@/components/ui/toast-notification";
import { ProgramsManagementTab } from "@/components/admin/ProgramsManagementTab";
import { AssignmentsManagementTab } from "@/components/admin/AssignmentsManagementTab";
import { AdminOverviewTab } from "@/components/admin/AdminOverviewTab";
import { AdminBreakdownTab } from "@/components/admin/AdminBreakdownTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminAddUserTab } from "@/components/admin/AdminAddUserTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import type { ProgramInfo, User as UserAccount } from "@/types/portal";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  FileText,
  GitMerge,
  Globe,
  Loader2,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

type TabType = "overview" | "breakdown" | "assignments" | "users" | "add-user" | "programs" | "settings";

const ROLE_STYLES: Record<string, { badge: string; border: string; dot: string }> = {
  SUPERADMIN: {
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    border: "border-purple-500/30",
    dot: "bg-purple-500",
  },
  ADMIN: {
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    border: "border-blue-500/30",
    dot: "bg-blue-500",
  },
  SUPERVISOR: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    border: "border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  SUPERVISEE: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    border: "border-amber-500/30",
    dot: "bg-amber-500",
  },
};

function formatCsvCell(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

function buildCsvRows(report: SupervisorReportItem[]): string[][] {
  const rows: string[][] = [];
  for (const sup of report) {
    const interests = sup.areasOfInterest.join("; ");
    if (sup.students.length === 0) {
      rows.push([
        sup.name,
        sup.email,
        formatCsvCell(interests),
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
          formatCsvCell(interests),
          st.name,
          st.email,
          st.assignedDate,
          formatCsvCell(st.statement || ""),
        ]);
      }
    }
  }
  return rows;
}

export default function AdminPortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // User List & Filters
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Supervisor Report Data for Chart & Breakdown
  const [supervisorReport, setSupervisorReport] = useState<SupervisorReportItem[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // Export Loading
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Programs State
  const [programList, setProgramList] = useState<ProgramInfo[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  // Toast notifications
  const { addToast } = useToast();

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
      console.error("Failed to fetch users", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const res = await fetch("/api/admin/report");
      const data = await res.json();
      if (data.success) setSupervisorReport(data.report);
    } catch (err) {
      console.error("Failed to fetch supervisor report", err);
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const fetchPrograms = useCallback(async () => {
    setLoadingPrograms(true);
    try {
      const res = await fetch("/api/programs");
      const data = await res.json();
      if (data.success) setProgramList(data.programs);
    } catch (err) {
      console.error("Failed to fetch programs", err);
    } finally {
      setLoadingPrograms(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchReport();
      fetchPrograms();
    }
  }, [currentUser, fetchUsers, fetchReport, fetchPrograms]);

  const handleCreateProgram = async (data: { name: string; description: string; status: string }): Promise<boolean> => {
    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (resData.success) {
        addToast("success", `Program "${data.name}" created successfully.`);
        fetchPrograms();
        return true;
      } else {
        addToast("error", resData.error || "Failed to create program.");
        return false;
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
      return false;
    }
  };

  const handleUpdateProgramStatus = async (programId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPrograms();
        addToast("success", `Program status updated to ${newStatus}.`);
      } else {
        addToast("error", data.error || "Failed to update program.");
      }
    } catch (err: any) {
      addToast("error", err.message || "Request failed.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const res = await fetch("/api/admin/report");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch report data");
      const report: SupervisorReportItem[] = data.report;

      const headers = [
        "Supervisor Name",
        "Supervisor Email",
        "Areas of Interest",
        "Student Name",
        "Student Email",
        "Assigned Date",
        "Statement of Interest",
      ];
      const rows = buildCsvRows(report);
      const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `admin-supervisors-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("success", "CSV report exported.");
    } catch (err: any) {
      addToast("error", err.message || "Failed to export CSV");
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const res = await fetch("/api/admin/report");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch report data");
      await generateAdminPDFReport(data.report, currentUser?.name ?? "Administrator");
      addToast("success", "PDF report generated.");
    } catch (err: any) {
      addToast("error", err.message || "Failed to export PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  const counts = {
    total: userList.length,
    supervisees: userList.filter((u) => u.role === "SUPERVISEE").length,
    supervisors: userList.filter((u) => u.role === "SUPERVISOR").length,
    admins: userList.filter((u) => u.role === "ADMIN" || u.role === "SUPERADMIN").length,
    totalAssignedStudents: supervisorReport.reduce((acc, curr) => acc + curr.studentCount, 0),
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading Administration Workspace…</p>
      </div>
    );
  }

  const roleStyle = ROLE_STYLES[currentUser.role] ?? ROLE_STYLES.ADMIN;

  return (
    <div className="min-h-screen bg-muted/20 text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shadow-sm">
                S
              </div>
              <span className="font-bold text-sm tracking-tight">Admin Portal</span>
            </div>
            <Badge variant="outline" className={`text-[10px] font-mono uppercase font-semibold ${roleStyle.badge}`}>
              {currentUser.role}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              <span>{currentUser.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs font-medium gap-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 space-y-8">
        {/* Page Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">System Management & Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor supervisor workloads, manage user accounts, and configure system rules.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exportingCSV}
              className="text-xs font-semibold gap-1.5 shadow-sm"
            >
              {exportingCSV ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              )}
              <span>{exportingCSV ? "Exporting CSV…" : "Export CSV"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="text-xs font-semibold gap-1.5 shadow-sm"
            >
              {exportingPDF ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-rose-600" />
              )}
              <span>{exportingPDF ? "Exporting PDF…" : "Export PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Quick KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Total Accounts
                <Users className="h-4 w-4 text-primary opacity-80" />
              </CardDescription>
              <CardTitle className="text-3xl font-extrabold">{counts.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Supervisees
                <User className="h-4 w-4 text-amber-500 opacity-80" />
              </CardDescription>
              <CardTitle className="text-3xl font-extrabold">{counts.supervisees}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Supervisors
                <ShieldCheck className="h-4 w-4 text-emerald-500 opacity-80" />
              </CardDescription>
              <CardTitle className="text-3xl font-extrabold">{counts.supervisors}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                Active Pairings
                <BookOpen className="h-4 w-4 text-purple-500 opacity-80" />
              </CardDescription>
              <CardTitle className="text-3xl font-extrabold">{counts.totalAssignedStudents}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabbed Navigation Bar */}
        <div className="flex border-b border-border overflow-x-auto no-scrollbar gap-2 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Overview & Analytics
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("breakdown")}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "breakdown"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Supervisor Breakdown ({supervisorReport.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assignments")}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "assignments"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitMerge className="h-4 w-4" />
            Assignments
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "users"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            User Directory ({userList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("add-user")}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "add-user"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Account Provisioning
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("programs")}
            className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "programs"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-4 w-4" />
            Programs ({programList.length})
          </button>

          {currentUser.role === "SUPERADMIN" && (
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings className="h-4 w-4" />
              System Settings
            </button>
          )}
        </div>

        {/* Tab Contents */}
        {activeTab === "overview" && (
          <AdminOverviewTab
            supervisorReport={supervisorReport}
            loadingReport={loadingReport}
            onRefreshReport={fetchReport}
          />
        )}

        {activeTab === "breakdown" && (
          <AdminBreakdownTab
            supervisorReport={supervisorReport}
            loadingReport={loadingReport}
            onRefreshReport={fetchReport}
          />
        )}

        {activeTab === "assignments" && (
          <AssignmentsManagementTab
            programs={programList}
            users={userList}
            onRefreshData={() => {
              fetchReport();
              fetchPrograms();
            }}
          />
        )}

        {activeTab === "users" && (
          <AdminUsersTab
            userList={userList}
            loadingUsers={loadingUsers}
            onRefreshUsers={fetchUsers}
          />
        )}

        {activeTab === "add-user" && (
          <AdminAddUserTab
            currentUser={currentUser}
            onUserCreated={() => {
              fetchUsers();
              fetchReport();
            }}
          />
        )}

        {activeTab === "programs" && (
          <ProgramsManagementTab
            programs={programList}
            loading={loadingPrograms}
            onRefresh={fetchPrograms}
            onCreateProgram={handleCreateProgram}
            onUpdateStatus={handleUpdateProgramStatus}
          />
        )}

        {activeTab === "settings" && currentUser.role === "SUPERADMIN" && (
          <AdminSettingsTab />
        )}
      </main>
    </div>
  );
}
