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
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const BAR_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
];
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

interface UserAccount {
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

type TabType = "overview" | "users" | "add-user" | "settings";

const supervisorChartConfig = {
  students: {
    label: "Assigned Students",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

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


export default function AdminPortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // User List & Filters
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Supervisor Report Data for Chart & Breakdown
  const [supervisorReport, setSupervisorReport] = useState<SupervisorReportItem[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [expandedSupervisorId, setExpandedSupervisorId] = useState<string | null>(null);

  // User Creation Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("SUPERVISEE");
  const [createLoading, setCreateLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  // Export Loading
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Settings State
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
      fetchReport();
      if (currentUser.role === "SUPERADMIN") {
        fetchSettings();
      }
    }
  }, [currentUser, fetchUsers, fetchReport, fetchSettings]);

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
        setCreateStatus({ success: true, msg: `Account created successfully for ${newUserName}` });
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        fetchUsers();
        fetchReport();
      } else {
        setCreateStatus({ success: false, msg: data.error || "Failed to create user account" });
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
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsStatus({ success: true, msg: "System settings updated successfully." });
      } else {
        setSettingsStatus({ success: false, msg: data.error || "Failed to save settings." });
      }
    } catch (err: any) {
      setSettingsStatus({ success: false, msg: err.message || "Request failed." });
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSettingsStatus(null), 4000);
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
      const res = await fetch("/api/admin/report");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch report data");
      const rawReport: SupervisorReportItem[] = data.report;
      const report = [...rawReport].sort((a, b) => b.studentCount - a.studentCount);

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginL = 50;
      const marginR = pageW - 50;
      
      // Computer local time down to the second
      const localTimestamp = new Date().toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const totalStudents = report.reduce((acc, sup) => acc + sup.studentCount, 0);

      if (report.length === 0) {
        doc.setFontSize(12);
        doc.text("No supervisors found in database.", marginL, 100);
      } else {
        // --- COVER PAGE (Executive Summary, Workload Chart & Directory Table) ---
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("STUDENT SUPERVISION APPLICATION — MASTER REPORT", marginL, 45);

        doc.setDrawColor(0);
        doc.setLineWidth(1.5);
        doc.line(marginL, 52, marginR, 52);

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("EXECUTIVE SUMMARY & SUPERVISOR DIRECTORY", marginL, 75);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Generated on: ${localTimestamp}  |  Total Supervisors: ${report.length}  |  Total Active Pairings: ${totalStudents}`, marginL, 90);

        doc.setLineWidth(0.5);
        doc.setDrawColor(180);
        doc.line(marginL, 98, marginR, 98);

        // Vector Workload Bar Chart on Cover Page
        const maxCount = Math.max(...report.map((s) => s.studentCount), 1);
        const chartStartY = 114;
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("SUPERVISOR WORKLOAD DISTRIBUTION CHART", marginL, chartStartY);

        let currentY = chartStartY + 14;
        const barMaxW = 270;

        report.forEach((sup) => {
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(40);
          const truncatedName = sup.name.length > 18 ? sup.name.slice(0, 16) + "…" : sup.name;
          doc.text(truncatedName, marginL, currentY + 9);

          const barX = marginL + 110;
          const barW = Math.max((sup.studentCount / maxCount) * barMaxW, sup.studentCount > 0 ? 6 : 0);

          // Red (>=5), Orange (>=3), Green (<3)
          if (sup.studentCount >= 5) {
            doc.setFillColor(239, 68, 68);
          } else if (sup.studentCount >= 3) {
            doc.setFillColor(249, 115, 22);
          } else {
            doc.setFillColor(16, 185, 129);
          }

          if (barW > 0) {
            doc.roundedRect(barX, currentY + 1, barW, 9, 2, 2, "F");
          }

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 41, 59);
          doc.text(String(sup.studentCount), barX + barW + 6, currentY + 9);

          currentY += 15;
        });

        const summaryTableStartY = currentY + 12;

        // Master Summary Directory Table
        autoTable(doc, {
          startY: summaryTableStartY,
          margin: { left: marginL, right: 50 },
          head: [["#", "Supervisor Name", "Email Address", "Areas of Interest", "Students"]],
          body: report.map((sup, i) => [
            String(i + 1),
            sup.name,
            sup.email,
            sup.areasOfInterest.length > 0 ? sup.areasOfInterest.join(", ") : "General",
            String(sup.studentCount),
          ]),
          headStyles: {
            fillColor: [30, 41, 59] as any,
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8.5,
          },
          bodyStyles: {
            textColor: 0,
            fontSize: 8,
            cellPadding: 5,
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250] as any,
          },
          columnStyles: {
            0: { cellWidth: 22, halign: "center" },
            1: { cellWidth: 110 },
            2: { cellWidth: 135 },
            3: { cellWidth: "auto" },
            4: { cellWidth: 50, halign: "center" },
          },
        });

        // --- INDIVIDUAL SUPERVISOR BREAKDOWN PAGES ---
        report.forEach((sup, supIdx) => {
          doc.addPage();

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.text("STUDENT SUPERVISION APPLICATION — MASTER REPORT", marginL, 45);

          doc.setDrawColor(0);
          doc.setLineWidth(1.5);
          doc.line(marginL, 52, marginR, 52);

          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(`Supervisor Breakdown (${supIdx + 1} of ${report.length}): ${sup.name}`, marginL, 76);

          doc.setLineWidth(0.5);
          doc.line(marginL, 84, marginR, 84);

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

          doc.text(localTimestamp, marginL + 115, metaStartY + lineH * 3 + interestHeight);
          doc.text(String(sup.studentCount), marginL + 115, metaStartY + lineH * 4 + interestHeight);

          const tableStartY = metaStartY + lineH * 5 + interestHeight + 10;

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
                fillColor: [30, 41, 59] as any,
                textColor: 255,
                fontStyle: "bold",
                fontSize: 8.5,
              },
              bodyStyles: {
                textColor: 0,
                fontSize: 8.5,
                cellPadding: 5,
              },
              alternateRowStyles: {
                fillColor: [245, 247, 250] as any,
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

      // Page footer pass
      const totalPages = doc.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(marginL, pageH - 38, marginR, pageH - 38);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);

        doc.text("Student Supervision Application — Master Report", marginL, pageH - 24);
        doc.text(`Page ${pg} of ${totalPages}`, pageW / 2, pageH - 24, { align: "center" });

        doc.setTextColor(0);
      }

      doc.save(`admin-supervisors-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(err.message || "Failed to export PDF");
    } finally {
      setExportingPDF(false);
    }
  };

  // Filtered Users computation
  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const counts = {
    total: userList.length,
    supervisees: userList.filter((u) => u.role === "SUPERVISEE").length,
    supervisors: userList.filter((u) => u.role === "SUPERVISOR").length,
    admins: userList.filter((u) => u.role === "ADMIN" || u.role === "SUPERADMIN").length,
    totalAssignedStudents: supervisorReport.reduce((acc, curr) => acc + curr.studentCount, 0),
  };

  // Calculate Chart Data based on database supervisor report
  const maxStudentCount = Math.max(...supervisorReport.map((s) => s.studentCount), 1);

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
              {exportingCSV ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
              <span>{exportingCSV ? "Exporting CSV…" : "Export CSV"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exportingPDF}
              className="text-xs font-semibold gap-1.5 shadow-sm"
            >
              {exportingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-rose-600" />}
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

          {currentUser.role === "SUPERADMIN" && (
            <button
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

        {/* TAB 1: OVERVIEW & SUPERVISOR ANALYTICS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            
            {/* Top Chart Section: Supervisor Workload */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 mb-1">
                    Live Database Metrics
                  </Badge>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Supervisor Workload & Capacity Overview
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Real-time student assignment distribution per supervisor.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchReport}
                  disabled={loadingReport}
                  className="text-xs shrink-0 gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingReport ? "animate-spin" : ""}`} />
                  Refresh Analytics
                </Button>
              </CardHeader>

              <CardContent className="space-y-6">
                {loadingReport ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Fetching live supervisor data…</p>
                  </div>
                ) : supervisorReport.length === 0 ? (
                  <div className="py-12 text-center border border-dashed rounded-lg p-6 space-y-3">
                    <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                    <p className="text-sm font-semibold text-muted-foreground">No supervisor accounts found in database.</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Provision new supervisor accounts via the <strong>Account Provisioning</strong> tab to view workload analytics.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const sortedReport = [...supervisorReport].sort((a, b) => b.studentCount - a.studentCount);
                      return (
                        <>
                          {/* Shadcn UI Horizontal Row Bar Chart */}
                          <ChartContainer config={supervisorChartConfig} style={{ height: Math.max(sortedReport.length * 38, 160) }} className="w-full">
                            <BarChart
                              accessibilityLayer
                              data={sortedReport.map((s) => ({ name: s.name, students: s.studentCount }))}
                              layout="vertical"
                              margin={{
                                left: 10,
                                right: 35,
                                top: 5,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                              <YAxis
                                dataKey="name"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                width={120}
                                tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 14)}…` : val)}
                              />
                              <XAxis type="number" hide />
                              <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                              />
                              <Bar dataKey="students" radius={[0, 6, 6, 0]} barSize={18}>
                                {sortedReport.map((sup, index) => {
                                  const barColor =
                                    sup.studentCount >= 5
                                      ? "#ef4444" // Red for high student load
                                      : sup.studentCount >= 3
                                      ? "#f97316" // Orange for moderate load
                                      : "#10b981"; // Green for lower student load

                                  return <Cell key={`cell-${index}`} fill={barColor} />;
                                })}
                                <LabelList
                                  position="right"
                                  offset={8}
                                  className="fill-foreground font-bold"
                                  fontSize={12}
                                />
                              </Bar>
                            </BarChart>
                          </ChartContainer>

                          {/* Supervisor Workload Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {sortedReport.map((sup) => (
                              <div key={sup.id} className="p-3.5 rounded-lg bg-card border border-border/50 space-y-1.5 hover:border-border transition-all">
                                <div>
                                  <h3 className="font-bold text-sm text-foreground truncate">{sup.name}</h3>
                                  <p className="text-xs text-muted-foreground font-mono truncate">{sup.email}</p>
                                </div>
                                <div className="pt-1 flex items-center justify-between text-xs font-semibold text-primary">
                                  <span>Assigned Supervisees:</span>
                                  <span className="text-sm font-extrabold">{sup.studentCount}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supervisor Breakdown Accordion Cards */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold tracking-tight">Supervisor Detail Breakdown</h2>
              {[...supervisorReport]
                .sort((a, b) => b.studentCount - a.studentCount)
                .map((sup) => {
                const isExpanded = expandedSupervisorId === sup.id;

                return (
                  <Card key={sup.id} className="shadow-sm border-border/60 transition-all">
                    <CardHeader
                      className="p-4 cursor-pointer hover:bg-muted/30 transition-colors flex flex-row items-center justify-between"
                      onClick={() => setExpandedSupervisorId(isExpanded ? null : sup.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center font-bold text-xs">
                          {sup.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-sm font-bold">{sup.name}</CardTitle>
                          <CardDescription className="text-xs font-mono">{sup.email}</CardDescription>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <span className="text-xs font-semibold text-foreground">
                            {sup.studentCount} Assigned Student{sup.studentCount === 1 ? "" : "s"}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {sup.areasOfInterest.length > 0 ? sup.areasOfInterest.slice(0, 2).join(", ") : "General"}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="p-4 pt-0 border-t border-border/40 bg-muted/10 space-y-4">
                        <div className="pt-3">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                            Areas of Expertise / Interest
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {sup.areasOfInterest.length > 0 ? (
                              sup.areasOfInterest.map((interest, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {interest}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No topics specified</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                            Assigned Supervisees ({sup.students.length})
                          </h4>
                          {sup.students.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-3 border border-dashed rounded-md text-center">
                              No students currently assigned to this supervisor.
                            </p>
                          ) : (
                            <div className="divide-y divide-border/50 border border-border/50 rounded-lg overflow-hidden bg-card">
                              {sup.students.map((st, i) => (
                                <div key={i} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-foreground">{st.name}</div>
                                    <div className="text-muted-foreground font-mono text-[11px]">{st.email}</div>
                                    {st.statement && (
                                      <p className="text-muted-foreground italic text-[11px] mt-1 bg-muted/30 p-1.5 rounded">
                                        &ldquo;{st.statement}&rdquo;
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[11px] text-muted-foreground font-mono">Assigned: {st.assignedDate}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: USER DIRECTORY */}
        {activeTab === "users" && (
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold">User Account Directory</CardTitle>
                <CardDescription className="text-xs">
                  Manage registered accounts, view permissions, and search users.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loadingUsers} className="text-xs shrink-0 gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? "animate-spin" : ""}`} />
                Refresh List
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Search & Filter Chips Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or role…"
                    className="pl-10 text-xs"
                  />
                </div>

                {/* Role Filters */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  {["ALL", "SUPERVISEE", "SUPERVISOR", "ADMIN", "SUPERADMIN"].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                        roleFilter === r
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r === "ALL" ? "All Roles" : r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Directory Cards */}
              {loadingUsers ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">Loading accounts…</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center border border-dashed rounded-lg space-y-2">
                  <User className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-xs font-semibold text-muted-foreground">No accounts match your criteria.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/60 bg-card">
                  {filteredUsers.map((usr) => {
                    const style = ROLE_STYLES[usr.role] ?? ROLE_STYLES.SUPERVISEE;

                    return (
                      <div
                        key={usr.id}
                        className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                            {usr.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-foreground">{usr.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{usr.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`text-[10px] uppercase font-mono font-semibold ${style.badge}`}>
                            {usr.role}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: ACCOUNT PROVISIONING */}
        {activeTab === "add-user" && (
          <div className="max-w-2xl mx-auto w-full">
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-4 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20 mb-2">
                  <UserPlus className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Account Provisioning</CardTitle>
                <CardDescription className="text-xs">
                  Create and register new system accounts for Supervisees, Supervisors, or Admins.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {createStatus && (
                  <div
                    className={`flex items-center gap-2 p-3.5 rounded-lg border text-xs font-medium ${
                      createStatus.success
                        ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/15 border-destructive/25 text-destructive"
                    }`}
                  >
                    {createStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{createStatus.msg}</span>
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g. Jordan Miller"
                        className="pl-10"
                        disabled={createLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="jordan@example.com"
                        className="pl-10"
                        disabled={createLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pwd">Initial Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pwd"
                        type="password"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10"
                        disabled={createLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="role">Account Role</Label>
                    <Select value={newUserRole} onValueChange={(val) => val && setNewUserRole(val)}>
                      <SelectTrigger id="role" disabled={createLoading}>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPERVISEE">Supervisee (Student)</SelectItem>
                        <SelectItem value="SUPERVISOR">Supervisor (Academic/Professional)</SelectItem>
                        {currentUser.role === "SUPERADMIN" && (
                          <>
                            <SelectItem value="ADMIN">System Administrator</SelectItem>
                            <SelectItem value="SUPERADMIN">SuperAdmin</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={createLoading} className="w-full font-semibold mt-2">
                    {createLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account…
                      </>
                    ) : (
                      "+ Provision Account"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: SYSTEM SETTINGS (SUPERADMIN ONLY) */}
        {activeTab === "settings" && currentUser.role === "SUPERADMIN" && (
          <Card className="shadow-sm border-border/60 max-w-3xl mx-auto w-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] uppercase font-mono text-purple-600 border-purple-500/30 bg-purple-500/10">
                  SuperAdmin Only
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Sliders className="h-5 w-5 text-primary" />
                Global System Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Configure allowed domains, application features, and SMTP server integrations.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {settingsStatus && (
                <div
                  className={`flex items-center gap-2 p-3.5 rounded-lg border text-xs font-medium ${
                    settingsStatus.success
                      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/15 border-destructive/25 text-destructive"
                  }`}
                >
                  {settingsStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{settingsStatus.msg}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Registration Domain Controls */}
                <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Registration Domain Controls
                  </h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="allowedDomains" className="text-xs">Allowed Registration Domains</Label>
                    <Input
                      id="allowedDomains"
                      value={allowedDomains}
                      onChange={(e) => setAllowedDomains(e.target.value)}
                      placeholder="e.g. example.com, university.edu (Leave blank for unrestricted)"
                      disabled={savingSettings}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Comma-separated list of email domains permitted to register via Email OTP.
                    </p>
                  </div>
                </div>

                {/* Feature Controls */}
                <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Application Feature Flags
                  </h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="enableGroupSupervision" className="text-xs">Enable Group Supervision</Label>
                    <Select
                      value={enableGroupSupervision ? "true" : "false"}
                      onValueChange={(val) => setEnableGroupSupervision(val === "true")}
                      disabled={savingSettings}
                    >
                      <SelectTrigger id="enableGroupSupervision">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Disabled</SelectItem>
                        <SelectItem value="true">Enabled</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Permit supervisees to apply for supervision as collaborative student groups.
                    </p>
                  </div>
                </div>

                {/* SMTP Email Server Configuration */}
                <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    SMTP Email Server Configuration
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpHost" className="text-xs">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.example.com"
                        disabled={savingSettings}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPort" className="text-xs">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587 or 465"
                        disabled={savingSettings}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpUser" className="text-xs">SMTP Username</Label>
                      <Input
                        id="smtpUser"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="Username"
                        disabled={savingSettings}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPass" className="text-xs">SMTP Password</Label>
                      <Input
                        id="smtpPass"
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="••••••••"
                        disabled={savingSettings}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpFromName" className="text-xs">Sender Name</Label>
                      <Input
                        id="smtpFromName"
                        value={smtpFromName}
                        onChange={(e) => setSmtpFromName(e.target.value)}
                        placeholder="Supervision Portal"
                        disabled={savingSettings}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpFromEmail" className="text-xs">Sender Email</Label>
                      <Input
                        id="smtpFromEmail"
                        value={smtpFromEmail}
                        onChange={(e) => setSmtpFromEmail(e.target.value)}
                        placeholder="noreply@example.com"
                        disabled={savingSettings}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="smtpSecure" className="text-xs">Connection Security</Label>
                    <Select
                      value={smtpSecure ? "true" : "false"}
                      onValueChange={(val) => setSmtpSecure(val === "true")}
                      disabled={savingSettings}
                    >
                      <SelectTrigger id="smtpSecure">
                        <SelectValue placeholder="Select connection security" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Standard / STARTTLS (Port 587)</SelectItem>
                        <SelectItem value="true">SSL / TLS (Port 465)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button type="submit" disabled={savingSettings} className="w-full font-semibold">
                  {savingSettings ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Settings…
                    </>
                  ) : (
                    "Save All System Settings"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

