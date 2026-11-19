import { z } from "zod";

export const userPreferencesSchema = z.object({
  // Language & Region
  language: z.enum(["pt-BR", "en-US"]).default("pt-BR"),
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
  hiddenModuleIds: z.array(z.string()).default([]),
  hiddenDashboardWidgets: z.array(z.string()).default([]),
  showFinancialWidgetsOnDashboard: z.boolean().default(true),

  // Finances, Analytics & Notifications
  hideFinancialValues: z.boolean().default(false),
  showCents: z.boolean().default(true),
  budgetAlertsEnabled: z.boolean().default(true),
  analyticsDefaultPeriod: z.enum(["today", "7d", "30d", "month", "year"]).default("30d"),
  notificationsEnabled: z.boolean().default(true),
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
  { id: "overview", label: "Overview Summary Cards" },
  { id: "quick_capture", label: "Quick Capture" },
  { id: "learning_overview", label: "Learning, Focus & Habits Summary" },
  { id: "tasks_today", label: "Tasks Today" },
  { id: "active_projects", label: "Active Projects" },
  { id: "recent_notes", label: "Recent Notes" },
  { id: "recent_activity", label: "Recent Activity" },
  { id: "upcoming_events", label: "Upcoming Events" },
  { id: "recent_bookmarks", label: "Recent Bookmarks" },
  { id: "developer_snippets", label: "Developer Hub Snippets" },
  { id: "finances", label: "Personal Finances" },
] as const;

export const SETTINGS_CATEGORIES = [
  { id: "general", label: "General & Profile", keywords: "name bio language timezone currency date" },
  { id: "appearance", label: "Appearance & Accessibility", keywords: "theme dark light accent density font contrast" },
  { id: "productivity", label: "Productivity & Modules", keywords: "tasks calendar notes pomodoro habits learning flashcards" },
  { id: "navigation", label: "Navigation & Shortcuts", keywords: "sidebar hide modules keybindings shortcuts" },
  { id: "finances", label: "Finances & Privacy", keywords: "privacy hide values cents budget analytics" },
  { id: "notifications", label: "Notifications", keywords: "quiet hours alerts reminders" },
  { id: "devices", label: "Aplicativo e Dispositivos", keywords: "pwa android ios capacitor offline cache push" },
  { id: "data", label: "Dados e Armazenamento", keywords: "export backup json csv reset archive retention trash lixeira historico" },
  { id: "diagnostics", label: "Help & Diagnostics", keywords: "diagnostics health support bug report logs" },
] as const;
