"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, User, UserPlus } from "lucide-react";
import type { User as UserAccount } from "@/types/portal";

interface AdminAddUserTabProps {
  readonly currentUser: UserAccount;
  readonly onUserCreated: () => void;
}

export function AdminAddUserTab({ currentUser, onUserCreated }: AdminAddUserTabProps) {
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("SUPERVISEE");
  const [createLoading, setCreateLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  const handleCreateUser = async (e: React.SyntheticEvent<HTMLFormElement>) => {
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
        onUserCreated();
      } else {
        setCreateStatus({ success: false, msg: data.error || "Failed to create user account" });
      }
    } catch (err: any) {
      setCreateStatus({ success: false, msg: err.message || "Request failed" });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
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
  );
}
