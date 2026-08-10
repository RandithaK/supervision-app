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

function getRolePath(role: string) {
  if (role === "ADMIN" || role === "SUPERADMIN") return "/admin";
  if (role === "SUPERVISOR") return "/supervisor";
  if (role === "SUPERVISEE") return "/supervisee";
  return "/";
}

const TEST_ACCOUNTS = [
  {
    role: "SUPERADMIN",
    label: "Super Admin",
    email: "superadmin@example.com",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40",
    cardClass: "border-l-4 border-l-violet-300 dark:border-l-violet-600",
  },
  {
    role: "ADMIN",
    label: "Admin",
    email: "admin@example.com",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    cardClass: "border-l-4 border-l-blue-300 dark:border-l-blue-600",
  },
  {
    role: "SUPERVISOR",
    label: "Supervisor",
    email: "supervisor@example.com",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    cardClass: "border-l-4 border-l-emerald-300 dark:border-l-emerald-600",
  },
  {
    role: "SUPERVISEE",
    label: "Supervisee",
    email: "supervisee@example.com",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
    cardClass: "border-l-4 border-l-amber-300 dark:border-l-amber-600",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        router.push(getRolePath(data.user.role));
      }
    } catch {
      // not authenticated — stay on page
    }
  }, [router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

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
        router.push(getRolePath(data.user.role));
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reach server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav strip */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm">
              S
            </div>
            <span className="font-semibold text-sm">Student Supervision Application</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl space-y-6">

          {/* Page title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Sign In</h1>
            <p className="text-muted-foreground text-sm">
              Enter your credentials to access your role dashboard.
            </p>
          </div>

          {/* Test accounts */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                Seeded test accounts
              </CardTitle>
              <CardDescription className="text-xs">
                Click any card to pre-fill credentials. Password:{" "}
                <code className="text-primary font-mono font-bold">password123</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TEST_ACCOUNTS.map((a) => (
                  <button
                    key={a.role}
                    type="button"
                    onClick={() => { setEmail(a.email); setPassword("password123"); setError(""); }}
                    className={`text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors space-y-1.5 ${a.cardClass}`}
                  >
                    <Badge variant="outline" className={`text-[10px] font-semibold ${a.badgeClass}`}>
                      {a.role}
                    </Badge>
                    <div className="text-sm font-semibold">{a.label}</div>
                    <div className="text-[11px] text-muted-foreground font-mono truncate">{a.email}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or enter credentials</span>
            <Separator className="flex-1" />
          </div>

          {/* Login form */}
          <Card className="shadow-sm max-w-md mx-auto w-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold">Sign In to Your Account</CardTitle>
              <CardDescription className="text-xs">
                Public self-registration is disabled. Accounts are provisioned by Admins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/25 text-destructive text-xs font-medium">
                  {error}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full font-semibold">
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
