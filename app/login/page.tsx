"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);

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

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

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
    if (currentUser && (currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN")) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setCurrentUser(data.user);
        setJwtToken(data.token);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reach server");
    } finally {
      setLoading(false);
    }
  };

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
    setCurrentUser(null);
    setJwtToken(null);
    setUserList([]);
  };

  const quickFill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword("password123");
    setError("");
  };

  const roleBadgeVariants: Record<string, string> = {
    SUPERADMIN: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    ADMIN: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    SUPERVISOR: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    SUPERVISEE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  const canManageUsers = currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl space-y-8 my-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider font-semibold border-primary/30 text-primary">
            Supervision App Auth System
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Role-Based Authentication
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Public self-registration is disabled. Seed initial users via <code className="text-primary font-mono">npm run seed</code>. New accounts are created by authenticated Admins.
          </p>
        </div>

        {/* Test User Credentials (Populated via CLI Seed) */}
        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Seeded Test Accounts (Password: <code className="text-primary font-mono">password123</code>)
            </CardTitle>
            <CardDescription className="text-xs">
              Click any card below to pre-fill login credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { role: "SUPERADMIN", email: "superadmin@example.com", label: "Super Admin" },
                { role: "ADMIN", email: "admin@example.com", label: "Admin" },
                { role: "SUPERVISOR", email: "supervisor@example.com", label: "Supervisor" },
                { role: "SUPERVISEE", email: "supervisee@example.com", label: "Supervisee" },
              ].map((item) => {
                const badgeClass = roleBadgeVariants[item.role];
                return (
                  <div
                    key={item.role}
                    onClick={() => quickFill(item.email)}
                    className="p-3 rounded-xl border border-border bg-card/60 hover:bg-accent/80 cursor-pointer transition flex flex-col justify-between space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[10px] font-mono uppercase font-semibold ${badgeClass}`}>
                        {item.role}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground group-hover:text-primary transition">Fill &rarr;</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{item.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Auth State Panel */}
        {currentUser ? (
          <div className="space-y-6">
            
            {/* Active User Card */}
            <Card className="shadow-lg border-border">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <div>
                  <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 uppercase tracking-wide">
                    Active Session
                  </Badge>
                  <CardTitle className="text-2xl font-bold mt-1">{currentUser.name}</CardTitle>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  className="text-xs font-semibold"
                >
                  Log Out
                </Button>
              </CardHeader>

              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                    <span className="text-xs text-muted-foreground font-mono uppercase">User Profile</span>
                    <div className="text-sm"><strong className="text-muted-foreground">ID:</strong> <code className="text-xs text-primary">{currentUser.id}</code></div>
                    <div className="text-sm"><strong className="text-muted-foreground">Email:</strong> {currentUser.email}</div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-sm text-muted-foreground">Role:</span>
                      <Badge variant="outline" className={`text-xs font-mono uppercase font-bold ${roleBadgeVariants[currentUser.role]}`}>
                        {currentUser.role}
                      </Badge>
                    </div>
                  </div>

                  {jwtToken && (
                    <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2 flex flex-col justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground font-mono uppercase">JWT Auth Token</span>
                        <p className="text-[11px] text-primary/80 font-mono break-all line-clamp-3 mt-1 bg-background p-2 rounded border border-border">
                          {jwtToken}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">Cookie set: auth_token (HTTP-only)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Admin Controls: Create New User & View Users */}
            {canManageUsers ? (
              <Card className="shadow-lg border-border">
                <CardHeader className="border-b border-border pb-4">
                  <Badge variant="outline" className="w-fit text-xs text-primary border-primary/30 uppercase font-mono mb-1">
                    Admin Privileges
                  </Badge>
                  <CardTitle className="text-xl font-bold">Register New User Account</CardTitle>
                  <CardDescription className="text-xs">
                    As an authenticated {currentUser.role}, you can provision new user accounts into the system.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {createStatus && (
                    <div className={`p-3 rounded-xl border text-xs font-medium ${createStatus.success ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300" : "bg-destructive/15 border-destructive/30 text-destructive"}`}>
                      {createStatus.msg}
                    </div>
                  )}

                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div className="sm:col-span-2 pt-2">
                      <Button
                        type="submit"
                        disabled={createLoading}
                        className="w-full font-semibold text-sm"
                      >
                        {createLoading ? "Registering User..." : "+ Create User Account"}
                      </Button>
                    </div>
                  </form>

                  {/* User Directory */}
                  <div className="pt-4 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold">Registered Users Directory</h4>
                      <Button variant="ghost" size="sm" onClick={fetchUsers} className="text-xs text-primary hover:underline">
                        Refresh Directory
                      </Button>
                    </div>

                    {loadingUsers ? (
                      <div className="text-xs text-muted-foreground">Loading user directory...</div>
                    ) : (
                      <div className="divide-y divide-border rounded-xl border border-border bg-muted/20 overflow-hidden">
                        {userList.map((usr) => {
                          const badgeClass = roleBadgeVariants[usr.role] || "bg-muted text-muted-foreground";
                          return (
                            <div key={usr.id} className="p-3 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-semibold">{usr.name}</span>
                                <span className="text-muted-foreground ml-2 font-mono">{usr.email}</span>
                              </div>
                              <Badge variant="outline" className={`font-mono uppercase font-bold ${badgeClass}`}>
                                {usr.role}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-muted/20 text-muted-foreground text-xs text-center">
                User registration and management is restricted to Admin accounts. Log in as an Admin to register new users.
              </div>
            )}

          </div>
        ) : (
          <Card className="shadow-lg border-border">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Sign In to Your Account</CardTitle>
              <CardDescription className="text-xs">
                Public registration disabled. Enter your credentials or pick a test role above.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Email Address</Label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Password</Label>
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-semibold text-sm mt-2"
                >
                  {loading ? "Authenticating..." : "Sign In with JWT"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
