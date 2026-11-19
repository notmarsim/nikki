"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Download, RotateCcw, Search, Settings as SettingsIcon, Smartphone, Trash2 } from "lucide-react";
import { detectNikkiPlatform, isIosSafariBrowser, type NikkiPlatform } from "@/lib/platform";
import { applyUserPreferences } from "@/lib/apply-preferences";
import { ALL_TOURS, INITIAL_TOUR_ID } from "@/modules/onboarding/tours";
import { APP_MODULES } from "@/config/modules";
import {
  DEFAULT_KEYBINDINGS,
  formatKeyEventToCombo,
  KEYBINDING_LABELS,
  type KeybindingsConfig,
} from "@/lib/keybindings";
import {
  DASHBOARD_WIDGETS,
  SETTINGS_CATEGORIES,
  type UserPreferences,
} from "@/modules/settings/registry";
import { useTheme } from "@/components/providers/theme-provider";
import { useI18n } from "@/components/providers/i18n-provider";
import type { I18nKey } from "@/lib/i18n";
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
  const { t, tr, language, setLanguage, moduleName } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const setInterfaceMode = useUiStore((s) => s.setInterfaceMode);
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
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q) ||
        t(`settings.cat.${c.id}` as I18nKey).toLowerCase().includes(q)
    );
  }, [search, t]);

  const widgetLabel = (id: string, fallback: string) => {
    switch (id) {
      case "overview":
        return tr("Overview Summary Cards", "Cards de Resumo Geral");
      case "quick_capture":
        return tr("Quick Capture", "Captura Rápida");
      case "learning_overview":
        return tr("Learning, Focus & Habits Summary", "Resumo de Estudos, Foco e Hábitos");
      case "tasks_today":
        return tr("Today's Tasks", "Tarefas de Hoje");
      case "active_projects":
        return tr("Active Projects", "Projetos Ativos");
      case "recent_notes":
        return tr("Recent Notes", "Notas Recentes");
      case "recent_activity":
        return tr("Recent Activity", "Atividade Recente");
      case "upcoming_events":
        return tr("Upcoming Events", "Próximos Eventos");
      case "recent_bookmarks":
        return tr("Recent Bookmarks", "Favoritos Recentes");
      case "developer_snippets":
        return tr("Dev Hub Snippets", "Snippets do Dev Hub");
      case "finances":
        return tr("Personal Finances", "Finanças Pessoais");
      default:
        return fallback;
    }
  };

  const keybindingLabel = (key: keyof KeybindingsConfig, fallback: string) => {
    switch (key) {
      case "bold":
        return tr("Bold", "Negrito");
      case "italic":
        return tr("Italic", "Itálico");
      case "underline":
        return tr("Underline", "Sublinhado");
      case "strike":
        return tr("Strikethrough", "Tachado");
      case "code":
        return tr("Inline Code", "Código em Linha");
      case "highlight":
        return tr("Highlight", "Destaque");
      case "checklist":
        return tr("Checklist", "Lista de Tarefas");
      case "toTask":
        return tr("Convert Selection to Task", "Converter Seleção em Tarefa");
      case "commandPalette":
        return tr("Command Palette / Search", "Paleta de Comandos / Busca");
      case "quickCapture":
        return tr("Quick Capture (Inbox)", "Captura Rápida (Caixa de Entrada)");
      default:
        return fallback;
    }
  };

  const permissionLabel = (perm: string) => {
    switch (perm) {
      case "granted":
        return tr("Granted", "Permitida");
      case "denied":
        return tr("Denied", "Negada");
      case "default":
        return tr("Default", "Padrão");
      case "unsupported":
        return tr("Unsupported", "Não suportado");
      default:
        return perm;
    }
  };

  const updatePref = <K extends keyof UserPreferences>(key: K, val: UserPreferences[K]) => {
    if (key === "language") {
      setLanguage(val as "en-US" | "pt-BR");
    }
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      applyUserPreferences(next);
      return next;
    });
  };

  useEffect(() => {
    applyUserPreferences(prefs);
  }, [prefs]);

  const toggleDashboardWidget = (widgetId: string) => {
    const exists = prefs.hiddenDashboardWidgets.includes(widgetId);
    updatePref(
      "hiddenDashboardWidgets",
      exists
        ? prefs.hiddenDashboardWidgets.filter((id) => id !== widgetId)
        : [...prefs.hiddenDashboardWidgets, widgetId]
    );
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
        setMessage(tr("Failed to save settings.", "Falha ao salvar configurações."));
        return;
      }
      setTheme(themeChoice);
      setHiddenModuleIds(prefs.hiddenModuleIds);
      setInterfaceMode(prefs.interfaceMode);
      setMessage(t("settings.saved"));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        tr(
          "Reset all preferences to defaults? Your productivity data will not be affected.",
          "Restaurar todas as preferências para o padrão? Seus dados de produtividade não serão afetados."
        )
      )
    ) {
      return;
    }
    const res = await fetch("/api/settings", { method: "DELETE" });
    if (res.ok) {
      const json = await res.json();
      setPrefs(json.data.preferences);
      setHiddenModuleIds([]);
      setMessage(tr("Preferences restored to defaults.", "Preferências restauradas para o padrão."));
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
            {t("settings.title")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("settings.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-emerald-500">{message}</span>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("settings.saving") : t("settings.save")}
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
              placeholder={tr("Search settings...", "Buscar configurações...")}
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
                {t(`settings.cat.${cat.id}` as I18nKey)}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <div className="space-y-6 lg:col-span-9">
          {activeCat === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Profile, Language & Region", "Perfil, Idioma e Região")}</CardTitle>
                <CardDescription>
                  {tr(
                    "Personal identity and regional formatting preferences.",
                    "Identidade pessoal e preferências de formatação regional."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium">{tr("Display Name", "Nome de Exibição")}</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">{tr("Email", "E-mail")}</label>
                    <Input value={initialEmail} disabled />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium">{tr("Bio", "Bio")}</label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={tr("Short bio...", "Biografia curta...")}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium">{t("settings.language")}</label>
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
                    <label className="text-xs font-medium">{tr("Timezone (IANA)", "Fuso Horário (IANA)")}</label>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">{t("settings.currency")}</label>
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
                    <label className="text-xs font-medium">{t("settings.dateFormat")}</label>
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
                    <label className="text-xs font-medium">{t("settings.timeFormat")}</label>
                    <select
                      value={prefs.timeFormat}
                      onChange={(e) =>
                        updatePref("timeFormat", e.target.value as "24h" | "12h")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="24h">{tr("24 hours", "24 horas")}</option>
                      <option value="12h">{tr("12 hours", "12 horas")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{t("settings.weekStartsOn")}</label>
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
                      <option value="monday">{tr("Monday", "Segunda-feira")}</option>
                      <option value="sunday">{tr("Sunday", "Domingo")}</option>
                      <option value="saturday">{tr("Saturday", "Sábado")}</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeCat === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Appearance & Accessibility", "Aparência e Acessibilidade")}</CardTitle>
                <CardDescription>
                  {tr(
                    "Customize theme, density, typography, and motion preferences.",
                    "Personalize tema, densidade, tipografia e preferências de movimento."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as const).map((themeOpt) => (
                    <Button
                      key={themeOpt}
                      type="button"
                      size="sm"
                      variant={themeChoice === themeOpt ? "default" : "outline"}
                      onClick={() => {
                        setThemeChoice(themeOpt);
                        setTheme(themeOpt);
                      }}
                    >
                      {themeOpt === "light"
                        ? tr("Light", "Claro")
                        : themeOpt === "dark"
                          ? tr("Dark", "Escuro")
                          : tr("System", "Sistema")}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium">{tr("Density", "Densidade")}</label>
                    <select
                      value={prefs.density}
                      onChange={(e) =>
                        updatePref("density", e.target.value as "comfortable" | "compact")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="comfortable">{tr("Comfortable", "Confortável")}</option>
                      <option value="compact">{tr("Compact", "Compacta")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{tr("Font Size", "Tamanho da Fonte")}</label>
                    <select
                      value={prefs.fontSize}
                      onChange={(e) =>
                        updatePref("fontSize", e.target.value as "small" | "default" | "large")
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="small">{tr("Small", "Pequena")}</option>
                      <option value="default">{tr("Default", "Padrão")}</option>
                      <option value="large">{tr("Large", "Grande")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">{tr("Animations", "Animações")}</label>
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
                      <option value="enabled">{tr("Enabled", "Ativadas")}</option>
                      <option value="reduced">{tr("Reduced", "Reduzidas")}</option>
                      <option value="disabled">{tr("Disabled", "Desativadas")}</option>
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
                    {tr(
                      "Enable spellcheck underline in Notes editor",
                      "Ativar sublinhado de correção ortográfica no editor de Notas"
                    )}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={prefs.highContrast}
                      onChange={(e) => updatePref("highContrast", e.target.checked)}
                    />
                    {tr(
                      "High contrast UI borders and focus rings",
                      "Bordas de alto contraste e indicadores de foco"
                    )}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={prefs.showBreadcrumbs}
                      onChange={(e) => updatePref("showBreadcrumbs", e.target.checked)}
                    />
                    {tr("Show page breadcrumbs", "Exibir trilha de navegação (breadcrumbs)")}
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {activeCat === "productivity" && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Productivity & Module Defaults", "Produtividade e Padrões dos Módulos")}</CardTitle>
                <CardDescription>
                  {tr(
                    "Configure Tasks, Calendar, Focus, Habits, Learning, and Flashcards defaults.",
                    "Configure padrões de Tarefas, Calendário, Foco, Hábitos, Estudos e Flashcards."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <label className="font-medium">{tr("Default Task Priority", "Prioridade Padrão de Tarefas")}</label>
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
                    <option value="none">{tr("None", "Nenhuma")}</option>
                    <option value="low">{tr("Low", "Baixa")}</option>
                    <option value="medium">{tr("Medium", "Média")}</option>
                    <option value="high">{tr("High", "Alta")}</option>
                    <option value="urgent">{tr("Urgent", "Urgente")}</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">{tr("Calendar Default View", "Visualização Padrão do Calendário")}</label>
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
                    <option value="day">{tr("Day", "Dia")}</option>
                    <option value="week">{tr("Week", "Semana")}</option>
                    <option value="month">{tr("Month", "Mês")}</option>
                    <option value="agenda">{tr("Agenda", "Agenda")}</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">{tr("Pomodoro Focus (min)", "Foco Pomodoro (min)")}</label>
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
                  <label className="font-medium">{tr("Time Block Duration (min)", "Duração do Bloco de Tempo (min)")}</label>
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
                  <label className="font-medium">{tr("Daily Study Goal (min)", "Meta Diária de Estudos (min)")}</label>
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
                  <label className="font-medium">{tr("Flashcards Daily Limit", "Limite Diário de Flashcards")}</label>
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
                  <CardTitle>{t("settings.interfaceMode")}</CardTitle>
                  <CardDescription>
                    {t("settings.interfaceModeDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <button
                    type="button"
                    onClick={() => updatePref("interfaceMode", "simple")}
                    className={`rounded-xl border p-3 text-left ${
                      prefs.interfaceMode === "simple"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="font-semibold">{t("settings.simpleMode")}</div>
                    <div className="mt-0.5 text-[var(--muted-foreground)]">
                      {t("settings.simpleModeDesc")}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePref("interfaceMode", "advanced")}
                    className={`rounded-xl border p-3 text-left ${
                      prefs.interfaceMode === "advanced"
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="font-semibold">{t("settings.advancedMode")}</div>
                    <div className="mt-0.5 text-[var(--muted-foreground)]">
                      {t("settings.advancedModeDesc")}
                    </div>
                  </button>
                  <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2.5">
                    <div>
                      <div className="font-medium">{t("settings.guidedTour")}</div>
                      <div className="text-[var(--muted-foreground)]">
                        {t("settings.guidedTourDesc")}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch("/api/onboarding", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            welcomeCompleted: true,
                            tourStatus: "in_progress",
                            currentTourId: INITIAL_TOUR_ID,
                            currentStepIndex: 0,
                          }),
                        });
                        window.dispatchEvent(new Event("nikki:onboarding-updated"));
                      }}
                    >
                      {t("settings.redoTour")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{tr("Module Visibility (Sidebar)", "Visibilidade dos Módulos (Barra Lateral)")}</CardTitle>
                  <CardDescription>
                    {tr(
                      "Hide unused modules from the sidebar without deleting any data.",
                      "Oculte módulos não utilizados da barra lateral sem excluir nenhum dado."
                    )}
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
                        <span>{moduleName(mod.id, mod.name)}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{tr("Dashboard Widgets", "Widgets do Painel")}</CardTitle>
                  <CardDescription>
                    {tr(
                      "Choose which sections appear on your Dashboard.",
                      "Escolha quais seções aparecem no seu Painel."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                  {DASHBOARD_WIDGETS.map((widget) => {
                    const visible = !prefs.hiddenDashboardWidgets.includes(widget.id);
                    return (
                      <label
                        key={widget.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleDashboardWidget(widget.id)}
                        />
                        <span>{widgetLabel(widget.id, widget.label)}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{tr("Keyboard Shortcuts", "Atalhos de Teclado")}</CardTitle>
                    <CardDescription>
                      {tr(
                        "Click a binding and press your preferred keys.",
                        "Clique em um atalho e pressione as teclas desejadas."
                      )}
                    </CardDescription>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={resetKeybindings}>
                    {tr("Reset Shortcuts", "Restaurar Atalhos")}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {(Object.keys(KEYBINDING_LABELS) as Array<keyof KeybindingsConfig>).map((key) => {
                    const label = keybindingLabel(key, KEYBINDING_LABELS[key]);
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
                            ? tr("Press keys...", "Pressione as teclas...")
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
                <CardTitle>{tr("Finances, Analytics & Privacy", "Finanças, Análises e Privacidade")}</CardTitle>
                <CardDescription>
                  {tr(
                    "Control financial privacy mode and analytics display defaults.",
                    "Controle o modo de privacidade financeira e padrões de exibição de análises."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.hideFinancialValues}
                    onChange={(e) => updatePref("hideFinancialValues", e.target.checked)}
                  />
                  {tr(
                    "Hide Financial Values by default (Privacy Mode)",
                    "Ocultar valores financeiros por padrão (Modo Privacidade)"
                  )}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.showCents}
                    onChange={(e) => updatePref("showCents", e.target.checked)}
                  />
                  {tr(
                    "Show decimal cents in monetary summaries",
                    "Exibir centavos decimais nos resumos monetários"
                  )}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.budgetAlertsEnabled}
                    onChange={(e) => updatePref("budgetAlertsEnabled", e.target.checked)}
                  />
                  {tr("Enable budget threshold alerts", "Ativar alertas de limite de orçamento")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.showFinancialWidgetsOnDashboard}
                    onChange={(e) =>
                      updatePref("showFinancialWidgetsOnDashboard", e.target.checked)
                    }
                  />
                  {tr(
                    "Show financial summary widget on Dashboard",
                    "Exibir widget de resumo financeiro no Painel"
                  )}
                </label>
              </CardContent>
            </Card>
          )}

          {activeCat === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Notifications & Quiet Hours", "Notificações e Horário Silencioso")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.notificationsEnabled}
                    onChange={(e) => updatePref("notificationsEnabled", e.target.checked)}
                  />
                  {tr("Enable In-App Notifications", "Ativar Notificações no App")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.quietHoursEnabled}
                    onChange={(e) => updatePref("quietHoursEnabled", e.target.checked)}
                  />
                  {tr("Enable Quiet Hours", "Ativar Horário Silencioso")}
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
                  <div>
                    <label className="block mb-1 font-medium">{tr("Notification Mode", "Modo de Notificação")}</label>
                    <select
                      value={prefs.notificationMode}
                      onChange={(e) =>
                        updatePref(
                          "notificationMode",
                          e.target.value as "individual" | "bundled" | "daily_digest" | "weekly_digest"
                        )
                      }
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      <option value="bundled">{tr("Smart Bundles (Grouped)", "Resumos Agrupados (Smart Bundles)")}</option>
                      <option value="individual">{tr("Individual Notifications", "Notificações Individuais")}</option>
                      <option value="daily_digest">{tr("Daily Digest", "Resumo Diário")}</option>
                      <option value="weekly_digest">{tr("Weekly Digest", "Resumo Semanal")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">{tr("Reminder Lead Time (min)", "Antecedência dos Lembretes (min)")}</label>
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={prefs.notificationLeadMinutes}
                      onChange={(e) =>
                        updatePref("notificationLeadMinutes", Number(e.target.value) || 30)
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const res = await fetch("/api/notifications/bundles");
                    if (res.ok) {
                      const json = (await res.json()) as { data?: { bundles?: unknown[] } };
                      alert(
                        tr(
                          `${json.data?.bundles?.length ?? 0} smart bundle(s) updated in the Notification Center.`,
                          `${json.data?.bundles?.length ?? 0} resumo(s) inteligente(s) atualizado(s) na Central de Notificações.`
                        )
                      );
                    }
                  }}
                >
                  {tr("Generate Smart Bundles Now", "Gerar Resumos Agrupados Agora")}
                </Button>
                {prefs.quietHoursEnabled && (
                  <div className="flex gap-3 pt-1">
                    <div>
                      <label className="block mb-1">{tr("Start", "Início")}</label>
                      <Input
                        type="time"
                        value={prefs.quietHoursStart}
                        onChange={(e) => updatePref("quietHoursStart", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">{tr("End", "Fim")}</label>
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
                    {tr("App & Devices", "Aplicativo e Dispositivos")}
                  </CardTitle>
                  <CardDescription>
                    {tr("Nikki version, detected platform, notifications, and local cache.", "Versão do Nikki, plataforma detectada, notificações e cache local.")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[var(--muted-foreground)]">{tr("Version", "Versão")}</div>
                    <div className="mt-0.5 font-semibold">Nikki v0.2.0</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[var(--muted-foreground)]">{tr("Platform", "Plataforma")}</div>
                    <div className="mt-0.5 font-semibold">{platform}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] p-3">
                    <div className="text-[var(--muted-foreground)]">{tr("Connection", "Conexão")}</div>
                    <div className={`mt-0.5 font-semibold ${isOnline ? "text-emerald-500" : "text-amber-500"}`}>
                      {isOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {iosSafariPrompt && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{tr("Install on iPhone (Safari PWA)", "Instalar no iPhone (Safari PWA)")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
                    <p>{tr("1. Make sure you open Nikki in Safari.", "1. Certifique-se de abrir o Nikki no Safari.")}</p>
                    <p>{tr("2. Tap the Share icon in the bottom bar.", "2. Toque no ícone de Compartilhar na barra inferior.")}</p>
                    <p>{tr('3. Select "Add to Home Screen" and confirm.', '3. Selecione "Adicionar à Tela de Início" e confirme.')}</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[var(--accent)]" />
                    {tr("Notification Permissions & Devices", "Permissões & Dispositivos de Notificação")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{tr("Browser permission:", "Permissão do navegador:")} <strong>{permissionLabel(notifPerm)}</strong></span>
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
                                deviceLabel: `${platform} (${new Date().toLocaleDateString(locale)})`,
                              }),
                            });
                            queryClient.invalidateQueries({ queryKey: ["notification-devices"] });
                          }
                        }}
                      >
                        {tr("Allow Notifications", "Permitir Notificações")}
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
                              ? tr("Test notification logged and sent.", "Notificação de teste registrada e enviada.")
                              : tr("In-app notification created successfully.", "Notificação in-app criada com sucesso.")
                          );
                          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                            new Notification(tr("Nikki Test", "Teste do Nikki"), {
                              body: tr("Local notification is working!", "Notificação local funcionando!"),
                            });
                          }
                        }
                      }}
                    >
                      {tr("Send Test Notification", "Enviar Notificação de Teste")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if ("caches" in window) {
                          const keys = await caches.keys();
                          await Promise.all(keys.map((k) => caches.delete(k)));
                          setDeviceMsg(tr("Static cache cleared safely.", "Cache estático limpo com segurança."));
                        }
                      }}
                    >
                      {tr("Clear Static Cache", "Limpar Cache Estático")}
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
                            {d.platform} · {tr("Last seen", "Visto por último")} {new Date(d.lastSeenAt).toLocaleDateString(locale)}
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
                          title={tr("Remove device", "Remover dispositivo")}
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
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{tr("Data & Storage", "Dados e Armazenamento")}</CardTitle>
                  <CardDescription>
                    {tr(
                      "Configure weekly auto-archiving, history retention, and Trash.",
                      "Configure arquivamento automático semanal, retenção do histórico e Lixeira."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-[var(--border)] p-3">
                    <input
                      type="checkbox"
                      checked={prefs.autoArchiveTasks}
                      onChange={(e) => updatePref("autoArchiveTasks", e.target.checked)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">
                        {tr("Archive completed tasks at the end of the week", "Arquivar tasks concluídas ao término da semana")}
                      </div>
                      <p className="mt-0.5 text-[var(--muted-foreground)]">
                        {tr(
                          "Completed tasks stay visible until the end of the week and are then automatically moved to Archive. You can view or restore them anytime.",
                          "As tarefas concluídas permanecem visíveis até o fim da semana e depois são movidas automaticamente para o Arquivo. Você poderá consultá-las ou restaurá-las quando quiser."
                        )}
                      </p>
                    </div>
                  </label>

                  <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                    <label className="block font-medium">{tr("Keep archived tasks for", "Manter tasks arquivadas por")}</label>
                    <select
                      value={prefs.archiveRetentionYears}
                      onChange={async (e) => {
                        const val = e.target.value as "forever" | "1" | "2" | "5";
                        if (val !== "forever") {
                          const prevRes = await fetch("/api/archive", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "retention_preview", years: val }),
                          });
                          const prevJson = (await prevRes.json()) as {
                            data?: { affectedTasks?: number };
                          };
                          const affected = prevJson.data?.affectedTasks ?? 0;
                          const ok = window.confirm(
                            tr(
                              `Warning: enabling ${val}-year retention will permanently delete older archived records on the next run (${affected} task(s) would be affected right now). Continue?`,
                              `Atenção: ao ativar a retenção de ${val} ano(s), registros arquivados mais antigos serão excluídos permanentemente na próxima rotina (${affected} tarefa(s) seriam afetadas agora). Deseja continuar?`
                            )
                          );
                          if (!ok) return;
                        }
                        updatePref("archiveRetentionYears", val);
                      }}
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
                    >
                      <option value="forever">{tr("Forever — default", "Para sempre — padrão")}</option>
                      <option value="1">{tr("1 year", "1 ano")}</option>
                      <option value="2">{tr("2 years", "2 anos")}</option>
                      <option value="5">{tr("5 years", "5 anos")}</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3">
                    <div>
                      <div className="font-medium">{tr("Trash", "Lixeira")}</div>
                      <p className="text-[var(--muted-foreground)]">
                        {tr("Deleted items stay in Trash for 30 days.", "Itens excluídos permanecem na Lixeira por 30 dias.")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => router.push("/archive?tab=trash")}
                      >
                        {tr("Open Trash", "Abrir Lixeira")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!window.confirm(tr("Permanently empty the entire Trash?", "Esvaziar toda a Lixeira definitivamente?"))) return;
                          await fetch("/api/archive", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "empty_trash" }),
                          });
                          alert(tr("Trash emptied.", "Lixeira esvaziada."));
                        }}
                      >
                        {tr("Empty Trash", "Esvaziar Lixeira")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{tr("Data Export & Backup", "Exportação de Dados & Backup")}</CardTitle>
                  <CardDescription>
                    {tr(
                      "Export your task and project history as CSV or JSON, or restore default preferences.",
                      "Exporte seu histórico de tarefas e projetos em CSV ou JSON, ou restaure as preferências padrão."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.assign("/api/archive/export?scope=all&format=csv")}
                  >
                    <Download className="h-4 w-4" /> {tr("All Tasks (CSV)", "Todas as Tasks (CSV)")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.assign("/api/archive/export?scope=completed&format=csv")}
                  >
                    <Download className="h-4 w-4" /> {tr("Completed Tasks (CSV)", "Tasks Concluídas (CSV)")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.assign("/api/archive/export?scope=archived&format=json")}
                  >
                    <Download className="h-4 w-4" /> {tr("Archived Tasks (JSON)", "Tasks Arquivadas (JSON)")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.assign("/api/archive/export?scope=archived_projects&format=json")}
                  >
                    <Download className="h-4 w-4" /> {tr("Archived Projects (JSON)", "Projetos Arquivados (JSON)")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.assign("/api/settings/export")}
                  >
                    <Download className="h-4 w-4" /> {tr("Full Backup (JSON)", "Backup Completo (JSON)")}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleResetDefaults}>
                    <RotateCcw className="h-4 w-4" /> {tr("Restore Default Preferences", "Restaurar Preferências Padrão")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeCat === "tutorials" && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Help & Tutorials", "Ajuda & Tutoriais")}</CardTitle>
                <CardDescription>
                  {tr(
                    "Start or restart the initial guided tour and explore module-specific guides.",
                    "Inicie ou reinicie o tour guiado inicial e explore guias específicos por módulo."
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {ALL_TOURS.map((tour) => (
                  <div
                    key={tour.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-3"
                  >
                    <div>
                      <div className="font-semibold text-sm">{tour.title[language]}</div>
                      <p className="text-[var(--muted-foreground)]">{tour.description[language]}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={tour.id === INITIAL_TOUR_ID ? "default" : "outline"}
                      onClick={async () => {
                        await fetch("/api/onboarding", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            welcomeCompleted: true,
                            tourStatus: "in_progress",
                            currentTourId: tour.id,
                            currentStepIndex: 0,
                          }),
                        });
                        window.dispatchEvent(new Event("nikki:onboarding-updated"));
                      }}
                    >
                      {tr("Start Tour", "Iniciar Tour")}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeCat === "diagnostics" && (
            <Card>
              <CardHeader>
                <CardTitle>{tr("Help & Diagnostics", "Ajuda e Diagnóstico")}</CardTitle>
                <CardDescription>
                  {tr(
                    "Check your app and connection status, or share a technical summary with support if you run into an issue.",
                    "Verifique o status do aplicativo e da conexão, ou compartilhe um resumo técnico com o suporte se encontrar algum problema."
                  )}
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
                          <div className="text-[var(--muted-foreground)]">
                            {tr("Platform & Version", "Plataforma e Versão")}
                          </div>
                          <div className="mt-0.5 font-medium">
                            {snapshot.platform} · v{snapshot.appVersion}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">
                            {tr("Connectivity", "Conectividade")}
                          </div>
                          <div className="mt-0.5 font-medium">
                            {snapshot.online ? tr("Online", "Online") : tr("Offline", "Offline")}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">
                            {tr("Service Worker / Push", "Service Worker / Push")}
                          </div>
                          <div className="mt-0.5 font-medium">
                            SW: {snapshot.serviceWorkerSupported ? tr("Supported", "Suportado") : tr("No", "Não")} · Push:{" "}
                            {permissionLabel(snapshot.notificationPermission)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-[var(--border)] p-3">
                          <div className="text-[var(--muted-foreground)]">
                            {tr("Viewport & Timezone", "Tela e Fuso Horário")}
                          </div>
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
                            alert(
                              tr(
                                "Diagnostic JSON copied to clipboard.",
                                "JSON de diagnóstico copiado para a área de transferência."
                              )
                            );
                          }}
                        >
                          {tr("Copy Diagnostic JSON", "Copiar JSON de Diagnóstico")}
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
                              alert(
                                tr(
                                  "Diagnostic report sent successfully.",
                                  "Relatório de diagnóstico enviado com sucesso."
                                )
                              );
                            } else {
                              alert(
                                tr(
                                  "Failed to submit diagnostic report.",
                                  "Falha ao enviar relatório de diagnóstico."
                                )
                              );
                            }
                          }}
                        >
                          {tr("Send Diagnostic Report", "Enviar Relatório de Diagnóstico")}
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
