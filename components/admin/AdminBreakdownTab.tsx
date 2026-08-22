"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { SupervisorReportItem } from "@/lib/pdf/admin-pdf-report";

interface AdminBreakdownTabProps {
  readonly supervisorReport: SupervisorReportItem[];
  readonly loadingReport: boolean;
  readonly onRefreshReport: () => void;
}

export function AdminBreakdownTab({
  supervisorReport,
  loadingReport,
  onRefreshReport,
}: AdminBreakdownTabProps) {
  const [expandedSupervisorId, setExpandedSupervisorId] = useState<string | null>(null);

  const sortedReport = [...supervisorReport].sort((a, b) => b.studentCount - a.studentCount);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Supervisor Detail Breakdown</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Detailed allocation history, expertise topics, and assigned supervisee statements.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefreshReport}
          disabled={loadingReport}
          className="text-xs shrink-0 gap-1.5 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingReport ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {loadingReport ? (
        <div className="py-12 text-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Loading breakdown data…</p>
        </div>
      ) : sortedReport.length === 0 ? (
        <div className="py-12 text-center border border-dashed rounded-lg space-y-2 p-6">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
          <p className="text-xs font-semibold text-muted-foreground">
            No supervisor accounts found in database.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedReport.map((sup) => {
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
                        {sup.areasOfInterest.length > 0
                          ? sup.areasOfInterest.slice(0, 2).join(", ")
                          : "General"}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                          sup.areasOfInterest.map((interest) => (
                            <Badge key={interest} variant="secondary" className="text-xs font-normal">
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
                          {sup.students.map((st) => (
                            <div
                              key={st.email}
                              className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
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
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  Assigned: {st.assignedDate}
                                </span>
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
      )}
    </div>
  );
}
