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
                <div className="flex gap-2">
                  <Link href="/login">
                    <Button size="sm" variant="outline" className="text-xs font-semibold">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" className="text-xs font-semibold">
                      Register
                    </Button>
                  </Link>
                </div>
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
              <>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="font-semibold px-8">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" className="font-semibold px-8">
                    Register as Supervisee →
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>


      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        Student Supervision Application
      </footer>
    </div>
  );
}
