"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart3, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { SupervisorReportItem } from "@/lib/pdf/admin-pdf-report";

const supervisorChartConfig = {
  students: {
    label: "Assigned Students",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

interface BarShapeProps {
  value?: number;
  [key: string]: unknown;
}

function SupervisorBarShape(props: BarShapeProps) {
  const count = props.value ?? 0;
  const fill = count >= 5 ? "#ef4444" : count >= 3 ? "#f97316" : "#10b981";
  return <Rectangle {...props} fill={fill} />;
}

interface AdminOverviewTabProps {
  readonly supervisorReport: SupervisorReportItem[];
  readonly loadingReport: boolean;
  readonly onRefreshReport: () => void;
}

export function AdminOverviewTab({
  supervisorReport,
  loadingReport,
  onRefreshReport,
}: AdminOverviewTabProps) {
  const sortedReport = [...supervisorReport].sort((a, b) => b.studentCount - a.studentCount);

  let cardContent: React.ReactNode;
  if (loadingReport) {
    cardContent = (
      <div className="py-12 flex flex-col items-center justify-center space-y-2">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Fetching live supervisor data…</p>
      </div>
    );
  } else if (supervisorReport.length === 0) {
    cardContent = (
      <div className="py-12 text-center border border-dashed rounded-lg p-6 space-y-3">
        <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
        <p className="text-sm font-semibold text-muted-foreground">
          No supervisor accounts found in database.
        </p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Provision new supervisor accounts via the <strong>Account Provisioning</strong> tab to view workload analytics.
        </p>
      </div>
    );
  } else {
    cardContent = (
      <div className="space-y-6">
        {/* Shadcn UI Horizontal Row Bar Chart */}
        <ChartContainer
          config={supervisorChartConfig}
          style={{ height: Math.max(sortedReport.length * 38, 160) }}
          className="w-full"
        >
          <BarChart
            accessibilityLayer
            data={sortedReport.map((s) => ({ name: s.name, students: s.studentCount }))}
            layout="vertical"
            margin={{ left: 10, right: 35, top: 5, bottom: 5 }}
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
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Bar dataKey="students" radius={[0, 6, 6, 0]} barSize={18} shape={<SupervisorBarShape />}>
              <LabelList position="right" offset={8} className="fill-foreground font-bold" fontSize={12} />
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Supervisor Workload Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sortedReport.map((sup) => (
            <div
              key={sup.id}
              className="p-3.5 rounded-lg bg-card border border-border/50 space-y-1.5 hover:border-border transition-all"
            >
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Badge
              variant="outline"
              className="w-fit text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 mb-1"
            >
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
            onClick={onRefreshReport}
            disabled={loadingReport}
            className="text-xs shrink-0 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingReport ? "animate-spin" : ""}`} />
            Refresh Analytics
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {cardContent}
        </CardContent>
      </Card>
    </div>
  );
}
