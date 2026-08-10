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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function AdminPortalPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin user creation state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("SUPERVISEE");
  const [createLoading, setCreateLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  // User list state for Admin
  const [userList, setUserList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        if (data.user.role !== "ADMIN" && data.user.role !== "SUPERADMIN") {
          // Redirect unauthorized roles
          const target = data.user.role === "SUPERVISOR" ? "/supervisor" : "/supervisee";
          router.push(target);
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
      if (data.success) {
        setUserList(data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

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
        setCreateStatus({ success: true, msg: `User "${data.user.name}" (${data.user.role}) created successfully!` });
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("SUPERVISEE");
        fetchUsers();
      } else {
        setCreateStatus({ success: false, msg: data.error || "Failed to create user" });
      }
    } catch (err: any) {
      setCreateStatus({ success: false, msg: err.message || "Network error" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const roleBadgeVariants: Record<string, string> = {
    SUPERADMIN: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    SUPERVISOR: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    SUPERVISEE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  const filteredUsers = userList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSupervisees = userList.filter((u) => u.role === "SUPERVISEE").length;
  const totalSupervisors = userList.filter((u) => u.role === "SUPERVISOR").length;
  const totalAdmins = userList.filter((u) => u.role === "ADMIN" || u.role === "SUPERADMIN").length;

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground animate-pulse">Loading Admin Portal...</div>
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
            <span className="font-bold text-base">Admin Portal</span>
            <Badge variant="outline" className={`text-[10px] uppercase font-mono font-bold ${roleBadgeVariants[currentUser.role]}`}>
              {currentUser.role}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Logged in as <strong className="text-foreground">{currentUser.name}</strong>
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
          <h1 className="text-3xl font-extrabold tracking-tight">System Administration & Provisioning</h1>
          <p className="text-muted-foreground text-sm">
            Manage user roles, provision accounts, and oversee system directories.
          </p>
        </div>

        {/* System Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="shadow-sm border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold">Total Accounts</CardDescription>
              <CardTitle className="text-2xl font-bold">{userList.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold text-amber-400">Supervisees</CardDescription>
              <CardTitle className="text-2xl font-bold">{totalSupervisees}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold text-emerald-400">Supervisors</CardDescription>
              <CardTitle className="text-2xl font-bold">{totalSupervisors}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs uppercase font-semibold text-blue-400">Admins</CardDescription>
              <CardTitle className="text-2xl font-bold">{totalAdmins}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* User Provisioning Form */}
          <Card className="shadow-lg border-border lg:col-span-1">
            <CardHeader className="pb-4">
              <Badge variant="outline" className="w-fit text-xs text-primary border-primary/30 uppercase font-mono mb-1">
                Account Provisioning
              </Badge>
              <CardTitle className="text-lg font-bold">Create User Account</CardTitle>
              <CardDescription className="text-xs">
                Register a new user into SQLite database.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {createStatus && (
                <div className={`p-3 rounded-xl border text-xs font-medium ${createStatus.success ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300" : "bg-destructive/15 border-destructive/30 text-destructive"}`}>
                  {createStatus.msg}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Full Name</Label>
                  <Input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Jordan Miller"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Email Address</Label>
                  <Input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="jordan@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Password</Label>
                  <Input
                    type="password"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Assigned Role</Label>
                  <Select value={newUserRole} onValueChange={(val) => val && setNewUserRole(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPERVISEE">SUPERVISEE</SelectItem>
                      <SelectItem value="SUPERVISOR">SUPERVISOR</SelectItem>
                      {currentUser.role === "SUPERADMIN" && (
                        <>
                          <SelectItem value="ADMIN">ADMIN</SelectItem>
                          <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  disabled={createLoading}
                  className="w-full font-semibold text-sm mt-2"
                >
                  {createLoading ? "Registering User..." : "+ Create User Account"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* User Directory */}
          <Card className="shadow-lg border-border lg:col-span-2">
            <CardHeader className="pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold">Registered Users Directory</CardTitle>
                <CardDescription className="text-xs">
                  Active accounts currently registered in system database.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchUsers} className="text-xs">
                Refresh Directory
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user by name, email, or role..."
                className="text-xs"
              />

              {loadingUsers ? (
                <div className="text-xs text-muted-foreground py-8 text-center">Loading user directory...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
                  No matching user accounts found.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
                  {filteredUsers.map((usr) => {
                    const badgeClass = roleBadgeVariants[usr.role] || "bg-muted text-muted-foreground";
                    return (
                      <div key={usr.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/40 transition">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-sm">{usr.name}</div>
                          <div className="text-muted-foreground font-mono">{usr.email}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">ID: {usr.id}</div>
                        </div>
                        <Badge variant="outline" className={`font-mono uppercase font-bold text-[10px] ${badgeClass}`}>
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

      </main>
    </div>
  );
}
