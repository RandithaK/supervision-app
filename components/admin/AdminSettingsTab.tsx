"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/toast-notification";
import { AlertCircle, CheckCircle2, Globe, Loader2, Mail, Shield, Sliders } from "lucide-react";

export function AdminSettingsTab() {
  const [allowedDomains, setAllowedDomains] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [enableGroupSupervision, setEnableGroupSupervision] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  const { addToast } = useToast();

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setAllowedDomains(data.settings.ALLOWED_REGISTRATION_DOMAINS || "");
        setSmtpHost(data.settings.SMTP_HOST || "");
        setSmtpPort(data.settings.SMTP_PORT || "");
        setSmtpSecure(data.settings.SMTP_SECURE === "true");
        setSmtpUser(data.settings.SMTP_USER || "");
        setSmtpPass(data.settings.SMTP_PASS || "");
        setSmtpFromName(data.settings.SMTP_FROM_NAME || "");
        setSmtpFromEmail(data.settings.SMTP_FROM_EMAIL || "");
        setEnableGroupSupervision(data.settings.ENABLE_GROUP_SUPERVISION === "true");
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsStatus(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: [
            { key: "ALLOWED_REGISTRATION_DOMAINS", value: allowedDomains },
            { key: "SMTP_HOST", value: smtpHost },
            { key: "SMTP_PORT", value: smtpPort },
            { key: "SMTP_SECURE", value: smtpSecure ? "true" : "false" },
            { key: "SMTP_USER", value: smtpUser },
            { key: "SMTP_PASS", value: smtpPass },
            { key: "SMTP_FROM_NAME", value: smtpFromName },
            { key: "SMTP_FROM_EMAIL", value: smtpFromEmail },
            { key: "ENABLE_GROUP_SUPERVISION", value: enableGroupSupervision ? "true" : "false" },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSettingsStatus({ success: true, msg: "System settings updated successfully." });
        addToast("success", "System settings updated successfully.");
      } else {
        setSettingsStatus({ success: false, msg: data.error || "Failed to save settings." });
        addToast("error", data.error || "Failed to save settings.");
      }
    } catch (err: any) {
      setSettingsStatus({ success: false, msg: err.message || "Request failed." });
      addToast("error", err.message || "Request failed.");
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSettingsStatus(null), 4000);
    }
  };

  return (
    <Card className="shadow-sm border-border/60 max-w-3xl mx-auto w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="outline"
            className="text-[10px] uppercase font-mono text-purple-600 border-purple-500/30 bg-purple-500/10"
          >
            SuperAdmin Only
          </Badge>
        </div>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <Sliders className="h-5 w-5 text-primary" />
          Global System Settings
        </CardTitle>
        <CardDescription className="text-xs">
          Configure allowed domains, application features, and SMTP server integrations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {settingsStatus && (
          <div
            className={`flex items-center gap-2 p-3.5 rounded-lg border text-xs font-medium ${
              settingsStatus.success
                ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/15 border-destructive/25 text-destructive"
            }`}
          >
            {settingsStatus.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{settingsStatus.msg}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Registration Domain Controls */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Registration Domain Controls
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="allowedDomains" className="text-xs">Allowed Registration Domains</Label>
              <Input
                id="allowedDomains"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="e.g. example.com, university.edu (Leave blank for unrestricted)"
                disabled={savingSettings}
              />
              <p className="text-[11px] text-muted-foreground">
                Comma-separated list of email domains permitted to register via Email OTP.
              </p>
            </div>
          </div>

          {/* Feature Controls */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Application Feature Flags
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="enableGroupSupervision" className="text-xs">Enable Group Supervision</Label>
              <Select
                value={enableGroupSupervision ? "true" : "false"}
                onValueChange={(val) => setEnableGroupSupervision(val === "true")}
                disabled={savingSettings}
              >
                <SelectTrigger id="enableGroupSupervision">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Disabled</SelectItem>
                  <SelectItem value="true">Enabled</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Permit supervisees to apply for supervision as collaborative student groups.
              </p>
            </div>
          </div>

          {/* SMTP Email Server Configuration */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border/50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              SMTP Email Server Configuration
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="smtpHost" className="text-xs">SMTP Host</Label>
                <Input
                  id="smtpHost"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  disabled={savingSettings}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpPort" className="text-xs">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587 or 465"
                  disabled={savingSettings}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="smtpUser" className="text-xs">SMTP Username</Label>
                <Input
                  id="smtpUser"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="Username"
                  disabled={savingSettings}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpPass" className="text-xs">SMTP Password</Label>
                <Input
                  id="smtpPass"
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••"
                  disabled={savingSettings}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="smtpFromName" className="text-xs">Sender Name</Label>
                <Input
                  id="smtpFromName"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  placeholder="Supervision Portal"
                  disabled={savingSettings}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpFromEmail" className="text-xs">Sender Email</Label>
                <Input
                  id="smtpFromEmail"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="noreply@example.com"
                  disabled={savingSettings}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="smtpSecure" className="text-xs">Connection Security</Label>
              <Select
                value={smtpSecure ? "true" : "false"}
                onValueChange={(val) => setSmtpSecure(val === "true")}
                disabled={savingSettings}
              >
                <SelectTrigger id="smtpSecure">
                  <SelectValue placeholder="Select connection security" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Standard / STARTTLS (Port 587)</SelectItem>
                  <SelectItem value="true">SSL / TLS (Port 465)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={savingSettings} className="w-full font-semibold">
            {savingSettings ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Settings…
              </>
            ) : (
              "Save All System Settings"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
