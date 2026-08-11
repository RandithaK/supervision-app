"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

function getRolePath(role: string) {
  if (role === "ADMIN" || role === "SUPERADMIN") return "/admin";
  if (role === "SUPERVISOR") return "/supervisor";
  if (role === "SUPERVISEE") return "/supervisee";
  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (searchParams.get("registered") === "true") {
      setSuccess("Account created successfully. Please log in.");
    }
  }, [fetchSession, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
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
    <Card className="shadow-lg border-border/50 max-w-md mx-auto w-full">
      <CardHeader className="pb-4 text-center">
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription>
          Sign in to your Supervision Portal account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/15 border border-destructive/25 text-destructive text-sm font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
            {success}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full mt-2">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col border-t bg-muted/20 p-4">
        <p className="text-sm text-center text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Register as Supervisee
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary mb-4 text-primary-foreground font-bold text-xl shadow-sm">
          S
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Supervision Portal</h1>
      </div>

      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <LoginForm />
      </Suspense>
      
      <div className="mt-8 text-center">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            ← Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
