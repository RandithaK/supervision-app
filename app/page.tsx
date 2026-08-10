"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

function getPortalPath(role?: string) {
  if (role === "ADMIN" || role === "SUPERADMIN") return "/admin";
  if (role === "SUPERVISOR") return "/supervisor";
  if (role === "SUPERVISEE") return "/supervisee";
  return "/login";
}

const PORTALS = [
  {
    role: "Admin & SuperAdmin",
    path: "/admin",
    badge: "Administration",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40",
    borderClass: "border-l-4 border-l-violet-300 dark:border-l-violet-600",
    title: "Admin Portal",
    description: "Provision and manage user accounts across all roles.",
    bullets: [
      "Register Supervisors and Supervisees",
      "Manage roles (SuperAdmin can create Admin accounts)",
      "Search and browse the registered user directory",
    ],
  },
  {
    role: "SUPERVISOR",
    path: "/supervisor",
    badge: "Supervisor",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    borderClass: "border-l-4 border-l-emerald-300 dark:border-l-emerald-600",
    title: "Supervisor Portal",
    description: "Manage your areas of interest and supervise students.",
    bullets: [
      "Set areas of interest to appear in supervisee search",
      "Accept or reject incoming supervision applications",
      "View your full list of assigned supervisees",
    ],
  },
  {
    role: "SUPERVISEE",
    path: "/supervisee",
    badge: "Supervisee",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
    borderClass: "border-l-4 border-l-amber-300 dark:border-l-amber-600",
    title: "Supervisee Portal",
    description: "Find a supervisor and track your application status.",
    bullets: [
      "Browse the full directory of available supervisors",
      "Filter supervisors by area of interest",
      "Apply for supervision and track application status",
    ],
  },
];

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setCurrentUser(d.authenticated ? d.user : null))
      .catch(() => setCurrentUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm">
              S
            </div>
            <span className="font-semibold text-sm tracking-tight">Student Supervision Application</span>
          </div>

          <div>
            {!loading && (
              currentUser ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Hello, <strong className="text-foreground">{currentUser.name}</strong>
                  </span>
                  <Link href={getPortalPath(currentUser.role)}>
                    <Button size="sm" className="text-xs font-semibold">
                      My Dashboard →
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href="/login">
                  <Button size="sm" className="text-xs font-semibold">
                    Sign In
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 sm:px-8 pt-16 pb-12 text-center space-y-5">
          <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
            Academic &amp; Professional Supervision
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Supervision,{" "}
            <span className="text-primary">simplified</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            A unified platform for managing student supervision — from account provisioning to application matching and assignment.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {currentUser ? (
              <Link href={getPortalPath(currentUser.role)}>
                <Button size="lg" className="font-semibold px-8">
                  Open My Portal ({currentUser.role}) →
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg" className="font-semibold px-8">
                  Sign In to Get Started →
                </Button>
              </Link>
            )}
          </div>
        </section>

        <Separator className="max-w-5xl mx-auto" />

        {/* Portal cards */}
        <section className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-6 text-center">
            Three role-based portals
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PORTALS.map((p) => (
              <Card key={p.role} className={`shadow-sm hover:shadow-md transition-shadow ${p.borderClass}`}>
                <CardHeader className="pb-2">
                  <Badge variant="outline" className={`w-fit text-[11px] font-semibold mb-2 ${p.badgeClass}`}>
                    {p.badge}
                  </Badge>
                  <CardTitle className="text-lg font-bold">{p.title}</CardTitle>
                  <CardDescription className="text-xs">{p.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {p.bullets.map((b) => (
                      <li key={b} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        Student Supervision Application
      </footer>
    </div>
  );
}
