"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme, type ThemeMode } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SettingsFormProps {
  initialName: string;
  initialEmail: string;
  initialTimezone: string;
  initialTheme: ThemeMode;
}

export function SettingsForm({
  initialName,
  initialEmail,
  initialTimezone,
  initialTheme,
}: SettingsFormProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(initialTheme);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          timezone,
          theme: selectedTheme,
        }),
      });

      if (!response.ok) {
        setStatusMessage("Failed to save settings.");
        return;
      }

      setTheme(selectedTheme);
      setStatusMessage("Settings saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Manage your Nikki identity and timezone preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="settings-email" className="text-sm font-medium">
              Email
            </label>
            <Input id="settings-email" value={initialEmail} disabled />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-name" className="text-sm font-medium">
              Display Name
            </label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-timezone" className="text-sm font-medium">
              Timezone
            </label>
            <Input
              id="settings-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose your preferred color theme across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(["light", "dark", "system"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={selectedTheme === mode ? "default" : "outline"}
                onClick={() => {
                  setSelectedTheme(mode);
                  setTheme(mode);
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
        {statusMessage && (
          <span className="text-sm text-[var(--muted-foreground)]">
            {statusMessage}
          </span>
        )}
      </div>
    </form>
  );
}
