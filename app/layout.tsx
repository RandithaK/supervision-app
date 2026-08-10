import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Student Supervision Application",
  description:
    "Role-based supervision application for SuperAdmins, Admins, Supervisors, and Supervisees.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable)}>
      <head>
        {/*
          Inline theme-init script — runs synchronously before first paint.
          Reads the system color-scheme preference and adds `.dark` to <html>
          so our CSS custom-variant `dark (&:is(.dark *))` activates correctly.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (prefersDark) {
                    document.documentElement.classList.add('dark');
                  }
                  // Keep in sync if the user changes system preference while the tab is open
                  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
                    document.documentElement.classList.toggle('dark', e.matches);
                  });
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
