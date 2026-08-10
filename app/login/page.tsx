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

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getRolePath = (role: string) => {
    if (role === "ADMIN" || role === "SUPERADMIN") return "/admin";
    if (role === "SUPERVISOR") return "/supervisor";
    if (role === "SUPERVISEE") return "/supervisee";
    return "/";
  };

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        // Automatically redirect logged-in user to their portal
        router.push(getRolePath(data.user.role));
      }
    } catch {
      // Not authenticated
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl space-y-8 my-8">
        
        {/* Header */}
        <div className="flex flex-col items-center space-y-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-2 text-xs text-muted-foreground hover:text-foreground">
              &larr; Back to Home Landing
            </Button>
          </Link>
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider font-semibold border-primary/30 text-primary">
            Student Supervision Application
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Sign In to Your Account
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto text-center">
            Public self-registration is disabled. Enter your credentials or pick a test account below to log in.
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
                { role: "SUPERADMIN", email: "superadmin@example.com", label: "Super Admin", target: "/admin" },
                { role: "ADMIN", email: "admin@example.com", label: "Admin", target: "/admin" },
                { role: "SUPERVISOR", email: "supervisor@example.com", label: "Supervisor", target: "/supervisor" },
                { role: "SUPERVISEE", email: "supervisee@example.com", label: "Supervisee", target: "/supervisee" },
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

        {/* Login Form */}
        <Card className="shadow-lg border-border max-w-md mx-auto w-full">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your email address and password to access your role dashboard.
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
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
