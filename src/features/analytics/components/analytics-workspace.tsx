"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CheckSquare,
  Download,
  Flame,
  GraduationCap,
  Layers,
  Plus,
  Timer,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AnalyticsPeriod } from "@/modules/analytics/utils";
import { formatCents } from "@/modules/finances/money";
import { useI18n } from "@/components/providers/i18n-provider";

export interface AnalyticsOverviewPayload {
  period: AnalyticsPeriod;
  range: { start: string; end: string; daysCount: number };
  kpis: {
    tasksCompleted: number;
    tasksCompletedDelta: number | null;
    tasksCreated: number;
    overdueTasks: number;
    focusMinutes: number;
    focusMinutesDelta: number | null;
    focusSessionsCount: number;
    activeCourses: number;
    completedLessons: number;
    flashcardReviews: number;
    flashcardRetention: number | null;
    activeHabits: number;
    habitConsistency: number;
  };
  productivity: {
    totalTasks: number;
    priorityCounts: Record<string, number>;
    activeProjects: number;
    inactiveProjects: Array<{ id: string; name: string; updatedAt: string | Date }>;
  };
  flashcards: {
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    dueNow: number;
    ratingDistribution: Record<number, number>;
  };
  focusByDay: Array<{ date: string; minutes: number }>;
  knowledgeStats?: {
    totalNotes: number;
    linkedToLearningCount: number;
    reviewedNotesCount: number;
    isolatedNotesCount: number;
    studySessionsCount: number;
    studySessionMinutes: number;
    quizAttemptsCount: number;
    avgQuizScorePercent: number | null;
  };
  savedReports: Array<{
    id: string;
    name: string;
    module: string;
    metric: string;
    groupBy: string;
    chartType: string;
    period: string;
  }>;
  finances: {
    month: string;
    summary: {
      totalAccountBalanceCents: number;
      monthIncomeCents: number;
      monthExpenseCents: number;
      monthResultCents: number;
    };
    expensesByCategory: Array<{
      categoryId: string;
      name: string;
      color: string;
      amountCents: number;
    }>;
  } | null;
}

type AnalyticsTab =
  | "overview"
  | "productivity"
  | "learning"
  | "focus"
  | "finances"
  | "custom";

function DeltaBadge({ delta }: { delta: number | null }) {
  const { tr } = useI18n();
  if (delta === null) {
    return (
      <span className="text-[11px] text-[var(--muted-foreground)]">
        {tr("— vs prev", "— vs anterior")}
      </span>
    );
  }
  const positive = delta >= 0;
  return (
    <span className={`text-[11px] font-medium ${positive ? "text-emerald-500" : "text-red-500"}`}>
      {positive ? `+${delta}%` : `${delta}%`} {tr("vs prev", "vs anterior")}
    </span>
  );
}

export function AnalyticsWorkspace({
  initialData,
  hideFinances = false,
}: {
  initialData: AnalyticsOverviewPayload;
  hideFinances?: boolean;
}) {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialData.period);
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [repName, setRepName] = useState("");
  const [repModule, setRepModule] = useState("focus");
  const [repMetric, setRepMetric] = useState("focusMinutes");
  const [repGroup, setRepGroup] = useState("day");
  const [repChart, setRepChart] = useState("bar");

  const { data = initialData } = useQuery<AnalyticsOverviewPayload>({
    queryKey: ["analytics-overview", period, !hideFinances],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/overview?period=${period}&includeFinances=${!hideFinances}`
      );
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      return json.data;
    },
    initialData,
  });

  const maxFocusDay = useMemo(() => {
    let m = 10;
    for (const d of data.focusByDay) {
      if (d.minutes > m) m = d.minutes;
    }
    return m;
  }, [data.focusByDay]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
  };

  const priorityLabel = (prio: string) => {
    switch (prio) {
      case "urgent":
        return tr("Urgent", "Urgente");
      case "high":
        return tr("High", "Alta");
      case "medium":
        return tr("Medium", "Média");
      case "low":
        return tr("Low", "Baixa");
      case "none":
        return tr("None", "Nenhuma");
      default:
        return prio;
    }
  };

  const moduleLabel = (mod: string) => {
    switch (mod) {
      case "focus":
        return tr("Focus", "Foco");
      case "tasks":
        return tr("Tasks", "Tarefas");
      case "learning":
        return tr("Learning", "Estudos");
      case "flashcards":
        return tr("Flashcards", "Flashcards");
      case "habits":
        return tr("Habits", "Hábitos");
      case "finances":
        return tr("Finances", "Finanças");
      default:
        return mod;
    }
  };

  const chartTypeLabel = (chartType: string) => {
    switch (chartType) {
      case "bar":
        return tr("Bar Chart", "Gráfico de Barras");
      case "line":
        return tr("Line Chart", "Gráfico de Linha");
      case "donut":
        return tr("Donut", "Rosca");
      case "table":
        return tr("Table", "Tabela");
      default:
        return chartType;
    }
  };

  const tabs: Array<{ id: AnalyticsTab; label: string }> = [
    { id: "overview", label: tr("Overview", "Visão Geral") },
    { id: "productivity", label: tr("Productivity & Projects", "Produtividade e Projetos") },
    { id: "learning", label: tr("Learning & Flashcards", "Estudos e Flashcards") },
    { id: "focus", label: tr("Focus & Habits", "Foco e Hábitos") },
    ...(!hideFinances ? [{ id: "finances" as const, label: tr("Finances", "Finanças") }] : []),
    {
      id: "custom",
      label: `${tr("Custom Reports", "Relatórios Personalizados")} (${data.savedReports.length})`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[var(--accent)]" />
            {tr("Advanced Analytics", "Análises Avançadas")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {tr(
              "Cross-module metrics, period comparisons, memory retention, and custom reports",
              "Métricas entre módulos, comparações de período, retenção de memória e relatórios personalizados"
            )}{" "}
            ({data.range.start} → {data.range.end}).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
            className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 text-xs"
          >
            <option value="today">{tr("Today", "Hoje")}</option>
            <option value="7d">{tr("Last 7 days", "Últimos 7 dias")}</option>
            <option value="30d">{tr("Last 30 days", "Últimos 30 dias")}</option>
            <option value="month">{tr("This Month", "Este Mês")}</option>
            <option value="year">{tr("This Year", "Este Ano")}</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.location.assign(`/api/analytics/export?period=${period}`)
            }
          >
            <Download className="h-3.5 w-3.5" /> {tr("Export CSV", "Exportar CSV")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Tasks Completed", "Tarefas Concluídas")}
                </CardTitle>
                <CheckSquare className="h-4 w-4 text-[var(--muted-foreground)]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.tasksCompleted}</div>
                <DeltaBadge delta={data.kpis.tasksCompletedDelta} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Focus Time", "Tempo de Foco")}
                </CardTitle>
                <Timer className="h-4 w-4 text-[var(--muted-foreground)]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.focusMinutes}m</div>
                <DeltaBadge delta={data.kpis.focusMinutesDelta} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Flashcard Reviews", "Revisões de Flashcards")}
                </CardTitle>
                <Layers className="h-4 w-4 text-[var(--muted-foreground)]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.flashcardReviews}</div>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {data.kpis.flashcardRetention !== null
                    ? `${data.kpis.flashcardRetention}% ${tr("observed retention", "de retenção observada")}`
                    : tr("No reviews in period", "Nenhuma revisão no período")}
                </span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs text-[var(--muted-foreground)]">
                  {tr("Habit Consistency", "Consistência de Hábitos")}
                </CardTitle>
                <Flame className="h-4 w-4 text-[var(--muted-foreground)]" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.habitConsistency}%</div>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {data.kpis.activeHabits} {tr("active habits", "hábitos ativos")}
                </span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Focus Minutes by Day", "Minutos de Foco por Dia")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.focusByDay.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  {tr(
                    "No focus sessions recorded in this period.",
                    "Nenhuma sessão de foco registrada neste período."
                  )}
                </p>
              ) : (
                <div className="flex items-end gap-2 h-40 pt-4">
                  {data.focusByDay.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className="w-full max-w-[28px] rounded-t bg-[var(--accent)]"
                        style={{
                          height: `${Math.max(5, Math.round((d.minutes / maxFocusDay) * 100))}%`,
                        }}
                        title={`${d.date}: ${d.minutes}m`}
                      />
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* PRODUCTIVITY */}
      {tab === "productivity" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Tasks by Priority", "Tarefas por Prioridade")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {Object.entries(data.productivity.priorityCounts).map(([prio, count]) => (
                <div key={prio} className="space-y-1">
                  <div className="flex justify-between">
                    <span>{priorityLabel(prio)}</span>
                    <span>{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{
                        width: `${
                          data.productivity.totalTasks > 0
                            ? Math.round((count / data.productivity.totalTasks) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Projects Inactive ≥ 14 Days", "Projetos Inativos ≥ 14 Dias")} (
                {data.productivity.inactiveProjects.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {data.productivity.inactiveProjects.length === 0 ? (
                <p className="text-[var(--muted-foreground)]">
                  {tr(
                    "All active projects have recent activity.",
                    "Todos os projetos ativos têm atividade recente."
                  )}
                </p>
              ) : (
                data.productivity.inactiveProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects?id=${p.id}`}
                    className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2 hover:bg-[var(--surface-muted)]"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[var(--muted-foreground)]">
                      {tr("Last update", "Última atualização")}{" "}
                      {new Date(p.updatedAt).toLocaleDateString(locale)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* LEARNING & FLASHCARDS */}
      {tab === "learning" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-[var(--accent)]" />{" "}
                {tr("Learning Summary", "Resumo de Estudos")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-2xl font-bold">{data.kpis.activeCourses}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {tr("Active Courses", "Cursos Ativos")}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="text-2xl font-bold">{data.kpis.completedLessons}</div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {tr("Lessons Completed", "Aulas Concluídas")}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Flashcard States & Ratings", "Estados e Avaliações de Flashcards")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded border border-[var(--border)] p-2">
                  <div className="font-bold text-base">{data.flashcards.totalCards}</div>
                  <div className="text-[var(--muted-foreground)]">{tr("Total", "Total")}</div>
                </div>
                <div className="rounded border border-[var(--border)] p-2">
                  <div className="font-bold text-base">{data.flashcards.newCards}</div>
                  <div className="text-[var(--muted-foreground)]">{tr("New", "Novos")}</div>
                </div>
                <div className="rounded border border-[var(--border)] p-2">
                  <div className="font-bold text-base">{data.flashcards.learningCards}</div>
                  <div className="text-[var(--muted-foreground)]">
                    {tr("Learning", "Aprendendo")}
                  </div>
                </div>
                <div className="rounded border border-[var(--border)] p-2">
                  <div className="font-bold text-base">{data.flashcards.reviewCards}</div>
                  <div className="text-[var(--muted-foreground)]">{tr("Review", "Revisão")}</div>
                </div>
              </div>
              <div className="flex justify-between text-[var(--muted-foreground)] pt-1">
                <span>{tr("Again:", "Errei:")} {data.flashcards.ratingDistribution[1] ?? 0}</span>
                <span>{tr("Hard:", "Difícil:")} {data.flashcards.ratingDistribution[2] ?? 0}</span>
                <span>{tr("Good:", "Bom:")} {data.flashcards.ratingDistribution[3] ?? 0}</span>
                <span>{tr("Easy:", "Fácil:")} {data.flashcards.ratingDistribution[4] ?? 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FOCUS & HABITS */}
      {tab === "focus" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tr("Focus & Consistency Summary", "Resumo de Foco e Consistência")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-center">
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="text-2xl font-bold">{data.kpis.focusSessionsCount}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Focus Sessions", "Sessões de Foco")}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="text-2xl font-bold">{data.kpis.focusMinutes}m</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Total Focus Time", "Tempo Total de Foco")}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <div className="text-2xl font-bold">{data.kpis.habitConsistency}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Habit Consistency", "Consistência de Hábitos")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FINANCES */}
      {tab === "learning" && data.knowledgeStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tr("Knowledge & Study Analytics", "Analytics de Conhecimento e Estudo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xl font-bold">{data.knowledgeStats.totalNotes}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{tr("Notes Created", "Notas Criadas")}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xl font-bold">{data.knowledgeStats.linkedToLearningCount}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{tr("Linked to Learning", "Vinculadas ao Learning")}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xl font-bold">{data.knowledgeStats.isolatedNotesCount}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{tr("Isolated Notes", "Notas Isoladas")}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3">
              <div className="text-xl font-bold">
                {data.knowledgeStats.avgQuizScorePercent !== null
                  ? `${data.knowledgeStats.avgQuizScorePercent}%`
                  : "—"}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Observed Quiz Avg", "Média Observada em Quizzes")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "finances" && !hideFinances && data.finances && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[var(--accent)]" />
              {tr("Financial Snapshot", "Resumo Financeiro")} ({data.finances.month})
            </CardTitle>
            <Link href="/finances" className="text-xs text-[var(--accent)] hover:underline">
              {tr("Open Finances →", "Abrir Finanças →")}
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Balance", "Saldo")}
              </div>
              <div className="text-lg font-bold">
                {formatCents(data.finances.summary.totalAccountBalanceCents)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Income", "Receitas")}
              </div>
              <div className="text-lg font-bold text-emerald-500">
                {formatCents(data.finances.summary.monthIncomeCents)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Expenses", "Despesas")}
              </div>
              <div className="text-lg font-bold text-red-500">
                {formatCents(data.finances.summary.monthExpenseCents)}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {tr("Result", "Resultado")}
              </div>
              <div className="text-lg font-bold">
                {formatCents(data.finances.summary.monthResultCents)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CUSTOM REPORT BUILDER */}
      {tab === "custom" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Custom Report Builder", "Construtor de Relatórios Personalizados")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!repName.trim()) return;
                  const res = await fetch("/api/analytics/reports", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: repName.trim(),
                      module: repModule,
                      metric: repMetric,
                      groupBy: repGroup,
                      chartType: repChart,
                      period,
                    }),
                  });
                  if (res.ok) {
                    setRepName("");
                    refresh();
                  }
                }}
                className="grid grid-cols-1 gap-2 sm:grid-cols-6"
              >
                <Input
                  value={repName}
                  onChange={(e) => setRepName(e.target.value)}
                  placeholder={tr("Report name", "Nome do relatório")}
                  required
                />
                <select
                  value={repModule}
                  onChange={(e) => setRepModule(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="focus">{tr("Focus", "Foco")}</option>
                  <option value="tasks">{tr("Tasks", "Tarefas")}</option>
                  <option value="learning">{tr("Learning", "Estudos")}</option>
                  <option value="flashcards">{tr("Flashcards", "Flashcards")}</option>
                  <option value="habits">{tr("Habits", "Hábitos")}</option>
                  <option value="finances">{tr("Finances", "Finanças")}</option>
                </select>
                <Input
                  value={repMetric}
                  onChange={(e) => setRepMetric(e.target.value)}
                  placeholder={tr("Metric", "Métrica")}
                  required
                />
                <select
                  value={repGroup}
                  onChange={(e) => setRepGroup(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="day">{tr("By Day", "Por Dia")}</option>
                  <option value="week">{tr("By Week", "Por Semana")}</option>
                  <option value="month">{tr("By Month", "Por Mês")}</option>
                  <option value="category">{tr("By Category", "Por Categoria")}</option>
                  <option value="project">{tr("By Project", "Por Projeto")}</option>
                </select>
                <select
                  value={repChart}
                  onChange={(e) => setRepChart(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="bar">{tr("Bar Chart", "Gráfico de Barras")}</option>
                  <option value="line">{tr("Line Chart", "Gráfico de Linha")}</option>
                  <option value="donut">{tr("Donut", "Rosca")}</option>
                  <option value="table">{tr("Table", "Tabela")}</option>
                </select>
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> {tr("Save", "Salvar")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.savedReports.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-sm">{r.name}</div>
                    <div className="mt-1 flex gap-1.5">
                      <Badge variant="outline">{moduleLabel(r.module)}</Badge>
                      <Badge variant="outline">{r.metric}</Badge>
                      <Badge variant="outline">{chartTypeLabel(r.chartType)}</Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/analytics/reports?id=${r.id}`, {
                        method: "DELETE",
                      });
                      refresh();
                    }}
                    className="text-[var(--muted-foreground)] hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
