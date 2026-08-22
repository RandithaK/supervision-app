"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2, RefreshCw, Search, User } from "lucide-react";
import type { User as UserAccount } from "@/types/portal";

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

interface AdminUsersTabProps {
  userList: UserAccount[];
  loadingUsers: boolean;
  onRefreshUsers: () => void;
}

export function AdminUsersTab({
  userList,
  loadingUsers,
  onRefreshUsers,
}: AdminUsersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold">User Account Directory</CardTitle>
          <CardDescription className="text-xs">
            Manage registered accounts, view permissions, and search users.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefreshUsers}
          disabled={loadingUsers}
          className="text-xs shrink-0 gap-1.5"
        >
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email, or role…"
              className="pl-10 text-xs"
            />
          </div>

          {/* Role Filters */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {["ALL", "SUPERVISEE", "SUPERVISOR", "ADMIN", "SUPERADMIN"].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRoleFilter(r);
                  setCurrentPage(1);
                }}
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

        {/* User Directory Cards with Pagination */}
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
          <div className="space-y-4">
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border/60 bg-card">
              {paginatedUsers.map((usr) => {
                const style = ROLE_STYLES[usr.role] ?? ROLE_STYLES.SUPERVISEE;

                return (
                  <div
                    key={usr.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
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
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase font-mono font-semibold ${style.badge}`}
                      >
                        {usr.role}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shadcn UI Pagination Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={5}>5 per page</option>
                  <option value={10}>10 per page</option>
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                </select>
                <span className="ml-2 font-mono">
                  Showing {startIndex + 1}–{Math.min(startIndex + pageSize, filteredUsers.length)} of{" "}
                  {filteredUsers.length}
                </span>
              </div>

              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={() => validPage > 1 && setCurrentPage((prev) => prev - 1)}
                      className={validPage === 1 ? "opacity-50 pointer-events-none" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - validPage) <= 1)
                    .map((p, i, arr) => {
                      const prevP = arr[i - 1];
                      const showEllipsis = prevP && p - prevP > 1;

                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={p === validPage}
                              onClick={() => setCurrentPage(p)}
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      );
                    })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={() => validPage < totalPages && setCurrentPage((prev) => prev + 1)}
                      className={validPage >= totalPages ? "opacity-50 pointer-events-none" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
