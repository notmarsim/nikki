import { z } from "zod";

export const userPreferencesSchema = z.object({
  // Language & Region
  language: z.enum(["en-US", "pt-BR"]).default("en-US"),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD/MM/YYYY"),
  timeFormat: z.enum(["24h", "12h"]).default("24h"),
  weekStartsOn: z.enum(["sunday", "monday", "saturday"]).default("monday"),
  defaultCurrency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),

  // Appearance & Accessibility
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
  fontSize: z.enum(["small", "default", "large"]).default("default"),
  animations: z.enum(["enabled", "reduced", "disabled"]).default("enabled"),
  highContrast: z.boolean().default(false),
  focusIndicators: z.boolean().default(true),
  showCardDescriptions: z.boolean().default(true),
  showBreadcrumbs: z.boolean().default(true),

  // Productivity Defaults
  defaultTaskPriority: z.enum(["none", "low", "medium", "high", "urgent"]).default("medium"),
  showCompletedTasks: z.boolean().default(true),
  confirmBeforeDelete: z.boolean().default(true),
  calendarDefaultView: z.enum(["day", "week", "month", "agenda"]).default("week"),
  calendarStartHour: z.number().int().min(0).max(12).default(7),
  calendarEndHour: z.number().int().min(13).max(23).default(22),
  timeBlockDuration: z.number().int().min(15).max(240).default(60),
  notesWordCount: z.boolean().default(true),
  notesLineNumbers: z.boolean().default(true),
  pomodoroFocusMinutes: z.number().int().min(5).max(120).default(25),
  pomodoroShortBreak: z.number().int().min(1).max(30).default(5),
  pomodoroLongBreak: z.number().int().min(5).max(60).default(15),
  habitDayCutoffHour: z.number().int().min(0).max(6).default(0),
  learningDailyGoalMinutes: z.number().int().min(10).max(480).default(60),
  flashcardDailyLimit: z.number().int().min(5).max(500).default(50),
  flashcardDesiredRetention: z.number().min(0.75).max(0.97).default(0.9),

  // Personalization & Navigation
  defaultHomePath: z.string().min(1).max(64).default("/dashboard"),
  interfaceMode: z.enum(["simple", "advanced"]).default("advanced"),
  moduleOrder: z.array(z.string()).default([]),
  hiddenModuleIds: z.array(z.string()).default([]),
  hiddenDashboardWidgets: z.array(z.string()).default([]),
  showFinancialWidgetsOnDashboard: z.boolean().default(true),
  recoveryEnabled: z.boolean().default(true),
  recoveryInactivityDays: z.number().int().min(1).max(30).default(3),

  // Finances, Analytics & Notifications
  hideFinancialValues: z.boolean().default(false),
  showCents: z.boolean().default(true),
  budgetAlertsEnabled: z.boolean().default(true),
  analyticsDefaultPeriod: z.enum(["today", "7d", "30d", "month", "year"]).default("30d"),
  notificationsEnabled: z.boolean().default(true),
  notificationMode: z.enum(["individual", "bundled", "daily_digest", "weekly_digest"]).default("bundled"),
  notificationLeadMinutes: z.number().int().min(5).max(1440).default(30),
  notificationMinPriority: z.enum(["all", "medium", "high", "urgent"]).default("all"),
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default("22:00"),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),

  // History, Archive & Retention
  autoArchiveTasks: z.boolean().default(true),
  archiveRetentionYears: z.enum(["forever", "1", "2", "5"]).default("forever"),
});

export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = userPreferencesSchema.parse({});

export function mergeUserPreferences(raw: unknown): UserPreferences {
  const safeObj = typeof raw === "object" && raw !== null ? raw : {};
  const parsed = userPreferencesSchema.safeParse(safeObj);
  if (parsed.success) return parsed.data;
  return { ...DEFAULT_USER_PREFERENCES };
}

export const DASHBOARD_WIDGETS = [
  { id: "overview", label: "Cards de Resumo Geral" },
  { id: "quick_capture", label: "Captura Rápida" },
  { id: "learning_overview", label: "Resumo de Estudos, Foco e Hábitos" },
  { id: "tasks_today", label: "Tarefas de Hoje" },
  { id: "active_projects", label: "Projetos Ativos" },
  { id: "recent_notes", label: "Notas Recentes" },
  { id: "recent_activity", label: "Atividade Recente" },
  { id: "upcoming_events", label: "Próximos Eventos" },
  { id: "recent_bookmarks", label: "Favoritos Recentes" },
  { id: "developer_snippets", label: "Snippets do Dev Hub" },
  { id: "finances", label: "Finanças Pessoais" },
] as const;

export const SETTINGS_CATEGORIES = [
  { id: "general", label: "Geral e Perfil", keywords: "name bio language timezone currency date nome idioma fuso" },
  { id: "appearance", label: "Aparência e Acessibilidade", keywords: "theme dark light accent density font contrast tema claro escuro" },
  { id: "productivity", label: "Produtividade e Módulos", keywords: "tasks calendar notes pomodoro habits learning flashcards tarefas" },
  { id: "navigation", label: "Navegação e Atalhos", keywords: "sidebar hide modules keybindings shortcuts simple advanced tour" },
  { id: "finances", label: "Finanças e Privacidade", keywords: "privacy hide values cents budget analytics privacidade" },
  { id: "notifications", label: "Notificações", keywords: "quiet hours alerts reminders silencio alertas" },
  { id: "devices", label: "Aplicativo e Dispositivos", keywords: "pwa android ios capacitor offline cache push" },
  { id: "data", label: "Dados e Armazenamento", keywords: "export backup json csv reset archive retention trash lixeira historico" },
  { id: "tutorials", label: "Ajuda e Tutoriais", keywords: "onboarding tour guide help tutorial walkthrough ajuda" },
  { id: "diagnostics", label: "Ajuda e Diagnóstico", keywords: "diagnostics health support bug report logs diagnostico" },
] as const;
