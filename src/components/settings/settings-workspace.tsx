"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Download, RotateCcw, Search, Settings as SettingsIcon, Smartphone, Trash2 } from "lucide-react";
import { detectNikkiPlatform, isIosSafariBrowser, type NikkiPlatform } from "@/lib/platform";
import { APP_MODULES } from "@/config/modules";
import {
  DEFAULT_KEYBINDINGS,
  formatKeyEventToCombo,
  KEYBINDING_LABELS,
  type KeybindingsConfig,
} from "@/lib/keybindings";
import {
  SETTINGS_CATEGORIES,
  type UserPreferences,
} from "@/modules/settings/registry";
import { useTheme } from "@/components/providers/theme-provider";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];

export function SettingsWorkspace({
  initialName,
  initialEmail,
  initialBio,
  initialTimezone,
  initialTheme,
  initialPreferences,
}: {
  initialName: string;
  initialEmail: string;
  initialBio: string | null;
  initialTimezone: string;
  initialTheme: "light" | "dark" | "system";
  initialPreferences: UserPreferences;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTheme } = useTheme();
  const [platform, setPlatform] = useState<NikkiPlatform>("desktop-web");
  const [iosSafariPrompt, setIosSafariPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [notifPerm, setNotifPerm] = useState<string>("default");
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null);

  useEffect(() => {
    setPlatform(detectNikkiPlatform());
    setIosSafariPrompt(isIosSafariBrowser());
    setIsOnline(navigator.onLine);
    if (typeof Notification !== "undefined") {
      setNotifPerm(Notification.permission);
    }
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const { data: deviceSubs } = useQuery<{
    devices: Array<{ id: string; platform: string; deviceLabel: string; lastSeenAt: string }>;
    vapidConfigured: boolean;
  }>({
    queryKey: ["notification-devices"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/subscriptions");
      if (!res.ok) return { devices: [], vapidConfigured: false };
      const json = await res.json();
      return json.data;
    },
  });
  const {
    spellcheckEnabled,
    setSpellcheckEnabled,
    keybindings,
    setKeybinding,
    resetKeybindings,
    setHiddenModuleIds,
  } = useUiStore();

  const [activeCat, setActiveCat] = useState<CategoryId>("general");
  const [search, setSearch] = useState("");
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio ?? "");
  const [timezone, setTimezone] = useState(initialTimezone);
  const [themeChoice, setThemeChoice] = useState<"light" | "dark" | "system">(initialTheme);
  const [prefs, setPrefs] = useState<UserPreferences>(initialPreferences);
  const [capturingKey, setCapturingKey] = useState<keyof KeybindingsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const visibleCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SETTINGS_CATEGORIES;
    return SETTINGS_CATEGORIES.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q)
    );
  }, [search]);

  const updatePref = <K extends keyof UserPreferences>(key: K, val: UserPreferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio: bio || null,
          timezone,
          theme: themeChoice,
          preferences: prefs,
        }),
      });
      if (!res.ok) {
        setMessage("Failed to save settings.");
        return;
      }
      setTheme(themeChoice);
      setHiddenModuleIds(prefs.hiddenModuleIds);
      setMessage("Settings saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm("Reset all preferences to defaults? Your productivity data will not be affected.")) {
      return;
    }
    const res = await fetch("/api/settings", { method: "DELETE" });
    if (res.ok) {
      const json = await res.json();
      setPrefs(json.data.preferences);
      setHiddenModuleIds([]);
      setMessage("Preferences restored to defaults.");
      router.refresh();
    }
  };

  const toggleModuleVisibility = (moduleId: string) => {
    const current = prefs.hiddenModuleIds;
    const next = current.includes(moduleId)
      ? current.filter((id) => id !== moduleId)
      : [...current, moduleId];
    updatePref("hiddenModuleIds", next);
    setHiddenModuleIds(next);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-[var(--accent)]" />
            Settings &amp; Personalization
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Configure profile, region, appearance, modules, financial privacy, and shortcuts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-emerald-500">{message}</span>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Categories Sidebar */}
        <aside className="space-y-3 lg:col-span-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  activeCat === cat.id
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <div className="space-y-6 lg:col-span-9">
          {activeCat === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>Profile, Language &amp; Region</CardTitle>
                <CardDescription>
                  Personal identity and regional formatting preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium">Display Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Email</label>
                    <Input value={initialEmail} disabled />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium">Bio</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short bio..."
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium">Language</label>
                    <select
                      value={prefs.language}
                      onChange={(e) =>
                        updatePref("language", e.target.value as "pt-BR" | "en-US")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                      <option value="en-US">English (US)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Timezone (IANA)</label>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Default Currency</label>
                    <select
                      value={prefs.defaultCurrency}
                      onChange={(e) =>
                        updatePref("defaultCurrency", e.target.value as "BRL" | "USD" | "EUR")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="BRL">BRL (R$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium">Date Format</label>
                    <select
                      value={prefs.dateFormat}
                      onChange={(e) =>
                        updatePref(
                          "dateFormat",
                          e.target.value as "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"
                        )
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Time Format</label>
                    <select
                      value={prefs.timeFormat}
                      onChange={(e) =>
                        updatePref("timeFormat", e.target.value as "24h" | "12h")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="24h">24 hours</option>
                      <option value="12h">12 hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Week Starts On</label>
                    <select
                      value={prefs.weekStartsOn}
                      onChange={(e) =>
                        updatePref(
                          "weekStartsOn",
                          e.target.value as "sunday" | "monday" | "saturday"
                        )
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="monday">Monday</option>
                      <option value="sunday">Sunday</option>
                      <option value="saturday">Saturday</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeCat === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance &amp; Accessibility</CardTitle>
                <CardDescription>
                  Customize theme, density, typography, and motion preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={themeChoice === t ? "default" : "outline"}
                      onClick={() => {
                        setThemeChoice(t);
                        setTheme(t);
                      }}
                      className="capitalize"
                    >
                      {t}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium">Density</label>
                    <select
                      value={prefs.density}
                      onChange={(e) =>
                        updatePref("density", e.target.value as "comfortable" | "compact")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Font Size</label>
                    <select
                      value={prefs.fontSize}
                      onChange={(e) =>
                        updatePref("fontSize", e.target.value as "small" | "default" | "large")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="small">Small</option>
                      <option value="default">Default</option>
                      <option value="large">Large</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Animations</label>
                    <select
                      value={prefs.animations}
                      onChange={(e) =>
                        updatePref(
                          "animations",
                          e.target.value as "enabled" | "reduced" | "disabled"
                        )
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="enabled">Enabled</option>
                      <option value="reduced">Reduced</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={spellcheckEnabled}
                      onChange={(e) => setSpellcheckEnabled(e.target.checked)}
                    />
                    Enable spellcheck underline in Notes editor
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={prefs.highContrast}
                      onChange={(e) => updatePref("highContrast", e.target.checked)}
                    />
                    High contrast UI borders and focus rings
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={prefs.showBreadcrumbs}
                      onChange={(e) => updatePref("showBreadcrumbs", e.target.checked)}
                    />
                    Show page breadcrumbs
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeCat === "productivity" && (
            <Card>
              <CardHeader>
                <CardTitle>Productivity &amp; Module Defaults</CardTitle>
                <CardDescription>
                  Configure Tasks, Calendar, Focus, Habits, Learning, and Flashcards defaults.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <label className="font-medium">Default Task Priority</label>
                  <select
                    value={prefs.defaultTaskPriority}
                    onChange={(e) =>
                      updatePref(
                        "defaultTaskPriority",
                        e.target.value as "none" | "low" | "medium" | "high" | "urgent"
                      )
                    }
                    className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 mt-1"
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">Calendar Default View</label>
                  <select
                    value={prefs.calendarDefaultView}
                    onChange={(e) =>
                      updatePref(
                        "calendarDefaultView",
                        e.target.value as "day" | "week" | "month" | "agenda"
                      )
                    }
                    className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 mt-1"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                    <option value="agenda">Agenda</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">Pomodoro Focus (min)</label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={prefs.pomodoroFocusMinutes}
                    onChange={(e) =>
                      updatePref("pomodoroFocusMinutes", Number(e.target.value) || 25)
                    }
                  />
                </div>
                <div>
                  <label className="font-medium">Time Block Duration (min)</label>
                  <Input
                    type="number"
                    min={15}
                    max={240}
                    value={prefs.timeBlockDuration}
                    onChange={(e) =>
                      updatePref("timeBlockDuration", Number(e.target.value) || 60)
                    }
                  />
                </div>
                <div>
                  <label className="font-medium">Daily Study Goal (min)</label>
                  <Input
                    type="number"
                    min={10}
                    max={480}
                    value={prefs.learningDailyGoalMinutes}
                    onChange={(e) =>
                      updatePref("learningDailyGoalMinutes", Number(e.target.value) || 60)
                    }
                  />
                </div>
                <div>
                  <label className="font-medium">Flashcards Daily Limit</label>
                  <Input
                    type="number"
                    min={5}
                    max={500}
                    value={prefs.flashcardDailyLimit}
                    onChange={(e) =>
                      updatePref("flashcardDailyLimit", Number(e.target.value) || 50)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {activeCat === "navigation" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Module Visibility (Sidebar)</CardTitle>
                  <CardDescription>
                    Hide unused modules from the sidebar without deleting any data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
                  {APP_MODULES.filter((m) => m.id !== "settings").map((mod) => {
                    const visible = !prefs.hiddenModuleIds.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleModuleVisibility(mod.id)}
                        />
                        <span>{mod.name}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Keyboard Shortcuts</CardTitle>
                    <CardDescription>Click a binding and press your preferred keys.</CardDescription>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={resetKeybindings}>
                    Reset Shortcuts
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {(Object.keys(KEYBINDING_LABELS) as Array<keyof KeybindingsConfig>).map((key) => {
                    const label = KEYBINDING_LABELS[key];
                    const isCapturing = capturingKey === key;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                      >
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={() => setCapturingKey(key)}
                          onKeyDown={(e) => {
                            if (!isCapturing) return;
                            e.preventDefault();
                            if (e.key === "Escape") {
                              setCapturingKey(null);
                              return;
                            }
                            const combo = formatKeyEventToCombo(e);
                            if (combo) {
                              setKeybinding(key, combo);
                              setCapturingKey(null);
                            }
                          }}
                          className={`min-w-[120px] rounded border px-2.5 py-1 font-mono ${
                            isCapturing
                              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                              : "border-[var(--border)] bg-[var(--surface-muted)]"
                          }`}
                        >
                          {isCapturing
                            ? "Press keys..."
                            : keybindings[key] ?? DEFAULT_KEYBINDINGS[key]}
                        </button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {activeCat === "finances" && (
            <Card>
              <CardHeader>
                <CardTitle>Finances, Analytics &amp; Privacy</CardTitle>
                <CardDescription>
                  Control financial privacy mode and analytics display defaults.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.hideFinancialValues}
                    onChange={(e) => updatePref("hideFinancialValues", e.target.checked)}
                  />
                  Hide Financial Values by default (Privacy Mode)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.showCents}
                    onChange={(e) => updatePref("showCents", e.target.checked)}
                  />
                  Show decimal cents in monetary summaries
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.budgetAlertsEnabled}
                    onChange={(e) => updatePref("budgetAlertsEnabled", e.target.checked)}
                  />
                  Enable budget threshold alerts
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.showFinancialWidgetsOnDashboard}
                    onChange={(e) =>
                      updatePref("showFinancialWidgetsOnDashboard", e.target.checked)
                    }
                  />
                  Show financial summary widget on Dashboard
                </label>
              </CardContent>
            </Card>
          )}

          {activeCat === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notifications &amp; Quiet Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.notificationsEnabled}
                    onChange={(e) => updatePref("notificationsEnabled", e.target.checked)}
                  />
                  Enable In-App Notifications
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.quietHoursEnabled}
                    onChange={(e) => updatePref("quietHoursEnabled", e.target.checked)}
                  />
                  Enable Quiet Hours
                </label>
                {prefs.quietHoursEnabled && (
                  <div className="flex gap-3 pt-1">
                    <div>
                      <label className="block mb-1">Start</label>
                      <Input
                        type="time"
                        value={prefs.quietHoursStart}
                        onChange={(e) => updatePref("quietHoursStart", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">End</label>
                      <Input
                        type="time"
                        value={prefs.quietHoursEnd}
                        onChange={(e) => updatePref("quietHoursEnd", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeCat === "devices" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[var(--accent)]" />
                    Aplicativo e Dispositivos
                  </CardTitle>
                  <CardDescription>
                    Versão do Nikki, plataforma detectada, notificações e cache local.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[var(--muted-foreground)]">Versão</div>
                    <div className="mt-0.5 font-semibold">Nikki v0.2.0</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[var(--muted-foreground)]">Plataforma</div>
                    <div className="mt-0.5 font-semibold">{platform}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[var(--muted-foreground)]">Conexão</div>
                    <div className={`mt-0.5 font-semibold ${isOnline ? "text-emerald-500" : "text-amber-500"}`}>
                      {isOnline ? "Online (Supabase)" : "Offline"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {iosSafariPrompt && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Instalar no iPhone (Safari PWA)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                    <p>1. Certifique-se de abrir o Nikki no Safari.</p>
                    <p>2. Toque no ícone de Compartilhar na barra inferior.</p>
                    <p>3. Selecione &ldquo;Adicionar à Tela de Início&rdquo; e confirme.</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[var(--accent)]" />
                    Permissões &amp; Dispositivos de Notificação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Permissão do navegador: <strong>{notifPerm}</strong></span>
                    {typeof Notification !== "undefined" && notifPerm !== "granted" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const res = await Notification.requestPermission();
                          setNotifPerm(res);
                          if (res === "granted") {
                            await fetch("/api/notifications/subscriptions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                platform: platform === "capacitor-android" ? "capacitor_android" : "web_push",
                                deviceLabel: `${platform} (${new Date().toLocaleDateString()})`,
                              }),
                            });
                            queryClient.invalidateQueries({ queryKey: ["notification-devices"] });
                          }
                        }}
                      >
                        Permitir Notificações
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const res = await fetch("/api/notifications/test", { method: "POST" });
                        if (res.ok) {
                          const json = await res.json();
                          const vapid = json.data?.remotePushConfigured?.webPushVapid;
                          setDeviceMsg(
                            vapid
                              ? "Notificação de teste registrada e enviada."
                              : "Notificação in-app criada no Supabase (VAPID/FCM remoto requer chaves configuradas no servidor)."
                          );
                          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                            new Notification("Nikki Test", { body: "Notificação local funcionando!" });
                          }
                        }
                      }}
                    >
                      Enviar Notificação de Teste
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if ("caches" in window) {
                          const keys = await caches.keys();
                          await Promise.all(keys.map((k) => caches.delete(k)));
                          setDeviceMsg("Cache estático limpo com segurança.");
                        }
                      }}
                    >
                      Limpar Cache Estático
                    </Button>
                  </div>

                  {deviceMsg && <p className="text-emerald-500">{deviceMsg}</p>}

                  <div className="space-y-1.5 pt-2">
                    {(deviceSubs?.devices ?? []).map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2"
                      >
                        <div>
                          <div className="font-medium">{d.deviceLabel}</div>
                          <div className="text-[11px] text-[var(--muted-foreground)]">
                            {d.platform} · Last seen {new Date(d.lastSeenAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch(`/api/notifications/subscriptions?id=${d.id}`, {
                              method: "DELETE",
                            });
                            queryClient.invalidateQueries({ queryKey: ["notification-devices"] });
                          }}
                          className="text-[var(--muted-foreground)] hover:text-red-500"
                          title="Remover dispositivo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeCat === "data" && (
            <Card>
              <CardHeader>
                <CardTitle>Data Export &amp; Reset</CardTitle>
                <CardDescription>
                  Export your personal workspace data in JSON or restore default preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.assign("/api/settings/export")}
                >
                  <Download className="h-4 w-4" /> Export Full Backup (JSON)
                </Button>
                <Button type="button" variant="outline" onClick={handleResetDefaults}>
                  <RotateCcw className="h-4 w-4" /> Restore Default Preferences
                </Button>
              </CardContent>
            </Card>
          )}

          {activeCat === "diagnostics" && (
            <Card>
              <CardHeader>
                <CardTitle>Help &amp; Diagnostics</CardTitle>
                <CardDescription>
                  Inspect your device &amp; PWA health locally and optionally send a sanitized snapshot (no tokens, cookies, or private content) to support.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const snapshot = {
                    platform: typeof navigator !== "undefined" ? detectNikkiPlatform() : "web",
                    appVersion: "2.0.0",
                    online: typeof navigator !== "undefined" ? navigator.onLine : true,
                    serviceWorkerSupported:
                      typeof navigator !== "undefined" && "serviceWorker" in navigator,
                    notificationPermission:
                      typeof Notification !== "undefined" ? Notification.permission : "unsupported",
                    viewport:
                      typeof window !== "undefined"
                        ? `${window.innerWidth}x${window.innerHeight}`
                        : "unknown",
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  };
                  return (
                    <>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">Platform &amp; Version</div>
                          <div className="mt-0.5 font-medium">
                            {snapshot.platform} · v{snapshot.appVersion}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">Connectivity</div>
                          <div className="mt-0.5 font-medium">
                            {snapshot.online ? "Online" : "Offline"}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">Service Worker / Push</div>
                          <div className="mt-0.5 font-medium">
                            SW: {snapshot.serviceWorkerSupported ? "Supported" : "No"} · Push:{" "}
                            {snapshot.notificationPermission}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">Viewport &amp; Timezone</div>
                          <div className="mt-0.5 font-medium">
                            {snapshot.viewport} · {snapshot.timezone}
                          </div>
                        </div>
                      </div>

                      <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-black/10 p-3 text-[11px]">
                        {JSON.stringify(snapshot, null, 2)}
                      </pre>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
                            alert("Diagnostic JSON copied to clipboard.");
                          }}
                        >
                          Copy Diagnostic JSON
                        </Button>
                        <Button
                          type="button"
                          onClick={async () => {
                            const res = await fetch("/api/diagnostics", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                platform: snapshot.platform,
                                appVersion: snapshot.appVersion,
                                summary: snapshot,
                              }),
                            });
                            if (res.ok) {
                              alert("Sanitized diagnostic report sent to Nikki Ops.");
                            } else {
                              alert("Failed to submit diagnostic report.");
                            }
                          }}
                        >
                          Send Diagnostic Report
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
