"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const getPortalPath = (role?: string) => {
    if (role === "ADMIN" || role === "SUPERADMIN") return "/admin";
    if (role === "SUPERVISOR") return "/supervisor";
    if (role === "SUPERVISEE") return "/supervisee";
    return "/login";
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
              S
            </div>
            <span className="font-bold text-lg tracking-tight">Student Supervision Application</span>
          </div>

          <div>
            {!loading && (
              currentUser ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Hello, <strong className="text-foreground">{currentUser.name}</strong>
                  </span>
                  <Link href={getPortalPath(currentUser.role)}>
                    <Button size="sm" className="font-semibold">
                      Go to Dashboard &rarr;
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href="/login">
                  <Button size="sm" className="font-semibold">
                    Sign In
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-12 sm:py-16 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <Badge variant="outline" className="px-3 py-1 text-xs uppercase tracking-wider font-semibold border-primary/30 text-primary">
            Academic & Professional Supervision
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Comprehensive Supervision Management
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Streamlining student supervision logs, supervisor reviews, and administrative account provisioning into a unified platform.
          </p>
          <div className="pt-4 flex justify-center gap-4">
            {currentUser ? (
              <Link href={getPortalPath(currentUser.role)}>
                <Button size="lg" className="font-semibold px-8 text-base">
                  Open My Portal ({currentUser.role}) &rarr;
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg" className="font-semibold px-8 text-base">
                  Sign In to Access Portals &rarr;
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* 3 Portal Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Admin Portal Card */}
          <Card className="shadow-md border-border flex flex-col justify-between hover:border-primary/50 transition">
            <CardHeader>
              <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono font-bold bg-blue-500/10 text-blue-400 border-blue-500/30 mb-2">
                Admin & SuperAdmin
              </Badge>
              <CardTitle className="text-xl font-bold">Admin Portal</CardTitle>
              <CardDescription className="text-xs">
                User account provisioning, role management, and system directory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>&bull; Register new Supervisors and Supervisees</p>
              <p>&bull; Manage roles (SuperAdmin can create Admin accounts)</p>
              <p>&bull; View and search the registered users directory</p>
            </CardContent>
          </Card>

          {/* Supervisor Portal Card */}
          <Card className="shadow-md border-border flex flex-col justify-between hover:border-primary/50 transition">
            <CardHeader>
              <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/30 mb-2">
                Supervisor Role
              </Badge>
              <CardTitle className="text-xl font-bold">Supervisor Portal</CardTitle>
              <CardDescription className="text-xs">
                Monitor assigned supervisees, review session logs, and grant approvals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>&bull; Set areas of interest to be discoverable by supervisees</p>
              <p>&bull; Review and action incoming supervision applications</p>
              <p>&bull; View all currently assigned supervisees</p>
            </CardContent>
          </Card>

          {/* Supervisee Portal Card */}
          <Card className="shadow-md border-border flex flex-col justify-between hover:border-primary/50 transition">
            <CardHeader>
              <Badge variant="outline" className="w-fit text-[10px] uppercase font-mono font-bold bg-amber-500/10 text-amber-400 border-amber-500/30 mb-2">
                Supervisee Role
              </Badge>
              <CardTitle className="text-xl font-bold">Supervisee Portal</CardTitle>
              <CardDescription className="text-xs">
                Log supervision hours, track required milestones, and view supervisor details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <p>&bull; Browse the full directory of available supervisors</p>
              <p>&bull; Filter supervisors by area of interest</p>
              <p>&bull; Apply for supervision and track application status</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
