"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme, type ThemeMode } from "@/components/providers/theme-provider";
import {
  formatKeyEventToCombo,
  KEYBINDING_LABELS,
  type KeybindingsConfig,
} from "@/lib/keybindings";
import { useUiStore } from "@/stores/ui-store";
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
  const {
    spellcheckEnabled,
    setSpellcheckEnabled,
    keybindings,
    setKeybinding,
    resetKeybindings,
  } = useUiStore();
  const [recordingKey, setRecordingKey] = useState<keyof KeybindingsConfig | null>(null);
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

      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
          <CardDescription>
            Customize writing behavior in Notes (code blocks never show spellcheck underlines).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium">Spellcheck (red underline)</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Show browser spelling underlines on regular text and titles.
              </div>
            </div>
            <input
              type="checkbox"
              checked={spellcheckEnabled}
              onChange={(e) => setSpellcheckEnabled(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)] cursor-pointer"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Keyboard Shortcuts</CardTitle>
            <CardDescription>
              Click any shortcut and press your preferred key combination.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetKeybindings}>
            Reset defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(KEYBINDING_LABELS) as Array<keyof KeybindingsConfig>).map(
            (action) => {
              const isRecording = recordingKey === action;
              return (
                <div
                  key={action}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span>{KEYBINDING_LABELS[action]}</span>
                  <button
                    type="button"
                    onClick={() => setRecordingKey(isRecording ? null : action)}
                    onKeyDown={(e) => {
                      if (!isRecording) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        setRecordingKey(null);
                        return;
                      }
                      const combo = formatKeyEventToCombo(e);
                      if (combo) {
                        setKeybinding(action, combo);
                        setRecordingKey(null);
                      }
                    }}
                    onBlur={() => {
                      if (isRecording) setRecordingKey(null);
                    }}
                    className={`min-w-[110px] rounded-md border px-2.5 py-1 text-xs font-mono transition-colors ${
                      isRecording
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {isRecording ? "Press keys..." : keybindings[action]}
                  </button>
                </div>
              );
            }
          )}
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
