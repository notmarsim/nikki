"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MAX_CSV_UPLOAD_BYTES,
  parseCsvLine,
  sanitizeCsvText,
} from "@/lib/file-security";
import { formatCents, parseMoneyToCents } from "@/modules/finances/money";

export interface FinanceOverviewPayload {
  month: string;
  summary: {
    totalAccountBalanceCents: number;
    monthIncomeCents: number;
    monthExpenseCents: number;
    monthResultCents: number;
    openStatementsTotalCents: number;
    pendingCents: number;
  };
  accounts: Array<{
    id: string;
    name: string;
    accountType: string;
    institution: string | null;
    currency: string;
    balanceCents: number;
    status: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    kind: string;
    color: string;
  }>;
  transactions: Array<{
    id: string;
    accountId: string | null;
    categoryId: string | null;
    type: string;
    status: string;
    amountCents: number;
    currency: string;
    description: string;
    transactionDate: string;
  }>;
  creditCards: Array<{
    id: string;
    name: string;
    institution: string;
    last4: string | null;
    creditLimitCents: number;
    usedLimitCents: number;
    availableLimitCents: number;
    closingDay: number;
    dueDay: number;
    currency: string;
  }>;
  statements: Array<{
    id: string;
    cardId: string;
    periodKey: string;
    dueDate: string;
    totalCents: number;
    paidCents: number;
    status: string;
  }>;
  budgets: Array<{
    id: string;
    name: string;
    categoryId: string | null;
    limitCents: number;
    spentCents: number;
    remainingCents: number;
    percent: number;
    currency: string;
  }>;
  recurringRules: Array<{
    id: string;
    name: string;
    type: string;
    amountCents: number;
    frequency: string;
    nextOccurrence: string;
    currency: string;
  }>;
  goals: Array<{
    id: string;
    name: string;
    targetCents: number;
    reservedCents: number;
    deadline: string | null;
    currency: string;
    status: string;
  }>;
  expensesByCategory: Array<{
    categoryId: string;
    name: string;
    color: string;
    amountCents: number;
  }>;
  monthlySeries: Array<{
    month: string;
    incomeCents: number;
    expenseCents: number;
  }>;
}

type FinanceTab =
  | "overview"
  | "transactions"
  | "accounts"
  | "cards"
  | "budgets"
  | "recurring"
  | "goals";

export function FinancesWorkspace({
  initialData,
  initialHideValues = false,
}: {
  initialData: FinanceOverviewPayload;
  initialHideValues?: boolean;
}) {
  const queryClient = useQueryClient();
  const { language, tr } = useI18n();
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [month, setMonth] = useState(initialData.month);
  const [hideValues, setHideValues] = useState(initialHideValues);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return;
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return month;
    return new Intl.DateTimeFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  }, [month, language]);

  // Forms state
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("checking");
  const [accInit, setAccInit] = useState("0,00");

  const [txAccount, setTxAccount] = useState(initialData.accounts[0]?.id ?? "");
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCat, setTxCat] = useState("");
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));

  const [trSrc, setTrSrc] = useState("");
  const [trDst, setTrDst] = useState("");
  const [trAmount, setTrAmount] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardLimit, setCardLimit] = useState("2000,00");
  const [cardClosing, setCardClosing] = useState("10");
  const [cardDue, setCardDue] = useState("17");

  const [purchCard, setPurchCard] = useState(initialData.creditCards[0]?.id ?? "");
  const [purchDesc, setPurchDesc] = useState("");
  const [purchAmount, setPurchAmount] = useState("");
  const [purchInstallments, setPurchInstallments] = useState("1");

  const [payAccount, setPayAccount] = useState(initialData.accounts[0]?.id ?? "");

  const [budName, setBudName] = useState("");
  const [budCat, setBudCat] = useState("");
  const [budLimit, setBudLimit] = useState("");

  const [recName, setRecName] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recFreq, setRecFreq] = useState("monthly");

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvAccount, setCsvAccount] = useState(initialData.accounts[0]?.id ?? "");
  const [csvExpenseSign, setCsvExpenseSign] = useState<"negative" | "positive">("negative");
  const [csvStatus, setCsvStatus] = useState<string | null>(null);

  const { data = initialData } = useQuery<FinanceOverviewPayload>({
    queryKey: ["finances-overview", month],
    queryFn: async () => {
      const res = await fetch(`/api/finances/overview?month=${month}`);
      if (!res.ok) throw new Error("Failed to load finances");
      const json = await res.json();
      return json.data;
    },
    initialData,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["finances-overview"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const fmt = (cents: number, currency = "BRL") =>
    formatCents(cents, currency, true, hideValues);

  const txTypeLabel = (type: string) => {
    switch (type) {
      case "income":
        return tr("Income", "Receita");
      case "expense":
        return tr("Expense", "Despesa");
      case "transfer":
        return tr("Transfer", "Transferência");
      case "refund":
        return tr("Refund", "Reembolso");
      case "adjustment":
        return tr("Adjustment", "Ajuste");
      default:
        return type;
    }
  };

  const txStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return tr("Paid", "Pago");
      case "settled":
        return tr("Settled", "Liquidado");
      case "completed":
        return tr("Completed", "Concluído");
      case "pending":
        return tr("Pending", "Pendente");
      case "cancelled":
        return tr("Cancelled", "Cancelado");
      case "scheduled":
        return tr("Scheduled", "Agendado");
      default:
        return status;
    }
  };

  const accountTypeLabel = (type: string) => {
    switch (type) {
      case "checking":
        return tr("Checking", "Conta Corrente");
      case "savings":
        return tr("Savings", "Poupança");
      case "cash":
        return tr("Cash", "Dinheiro");
      case "wallet":
        return tr("Digital Wallet", "Carteira Digital");
      case "investment":
        return tr("Investment", "Investimentos");
      default:
        return type;
    }
  };

  const statementStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return tr("Open", "Aberta");
      case "closed":
        return tr("Closed", "Fechada");
      case "paid":
        return tr("Paid", "Paga");
      case "partial":
        return tr("Partial", "Parcial");
      case "overdue":
        return tr("Overdue", "Vencida");
      default:
        return status;
    }
  };

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case "daily":
        return tr("Daily", "Diária");
      case "weekly":
        return tr("Weekly", "Semanal");
      case "monthly":
        return tr("Monthly", "Mensal");
      case "annual":
        return tr("Annual", "Anual");
      default:
        return freq;
    }
  };

  const maxMonthlyBar = useMemo(() => {
    let max = 100;
    for (const m of data.monthlySeries) {
      if (m.incomeCents > max) max = m.incomeCents;
      if (m.expenseCents > max) max = m.expenseCents;
    }
    return max;
  }, [data.monthlySeries]);

  const catMap = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c])),
    [data.categories]
  );

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    const cents = parseMoneyToCents(accInit || "0");
    const res = await fetch("/api/finances/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: accName.trim(),
        accountType: accType,
        initialBalanceCents: cents,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (!txAccount) setTxAccount(json.data.account.id);
      if (!payAccount) setPayAccount(json.data.account.id);
      if (!csvAccount) setCsvAccount(json.data.account.id);
      setAccName("");
      setAccInit("0,00");
      refresh();
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const accountId = txAccount || data.accounts[0]?.id;
    if (!accountId || !txDesc.trim() || !txAmount.trim()) return;
    const amountCents = Math.abs(parseMoneyToCents(txAmount));
    if (amountCents <= 0) return;

    const res = await fetch("/api/finances/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        categoryId: txCat || null,
        type: txType,
        amountCents,
        description: txDesc.trim(),
        transactionDate: txDate,
      }),
    });
    if (res.ok) {
      setTxDesc("");
      setTxAmount("");
      refresh();
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const accountId = csvAccount || data.accounts[0]?.id;
    if (!accountId || (!csvFile && !csvText.trim())) return;

    let res: Response;
    if (csvFile) {
      const fd = new FormData();
      fd.append("file", csvFile);
      fd.append("accountId", accountId);
      fd.append("expenseSign", csvExpenseSign);
      res = await fetch("/api/finances/import", {
        method: "POST",
        body: fd,
      });
    } else {
      const cleanText = sanitizeCsvText(csvText);
      const lines = cleanText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const parsedRows: Array<{
        date: string;
        description: string;
        amountCents: number;
        type: "income" | "expense";
      }> = [];

      for (const line of lines) {
        const parts = parseCsvLine(line);
        if (parts.length < 3) continue;
        const [dateRaw, descRaw, amountRaw] = parts;
        if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;
        try {
          const cents = parseMoneyToCents(amountRaw!);
          parsedRows.push({
            date: dateRaw,
            description: descRaw || "Imported",
            amountCents: Math.abs(cents),
            type:
              csvExpenseSign === "positive"
                ? cents >= 0
                  ? "expense"
                  : "income"
                : cents >= 0
                  ? "income"
                  : "expense",
          });
        } catch {
          // skip invalid line
        }
      }

      if (parsedRows.length === 0) {
        setCsvStatus(
          tr(
            "No valid rows found (expected: YYYY-MM-DD;Description;Amount).",
            "Nenhuma linha válida encontrada (esperado: AAAA-MM-DD;Descrição;Valor)."
          )
        );
        return;
      }

      res = await fetch("/api/finances/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          filename: "manual-import.csv",
          rows: parsedRows,
        }),
      });
    }

    const json = await res.json();
    if (res.ok) {
      setCsvStatus(
        tr(
          `Imported ${json.data.imported} rows (${json.data.skipped} duplicates skipped).`,
          `${json.data.imported} linha(s) importada(s) (${json.data.skipped} duplicata(s) ignorada(s)).`
        )
      );
      setCsvFile(null);
      setCsvText("");
      refresh();
    } else {
      setCsvStatus(json.error?.message ?? tr("Failed to import CSV.", "Falha ao importar CSV."));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-[var(--accent)]" />
            {tr("Personal Finances", "Finanças Pessoais")}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {tr(
              "Manage accounts, credit card installments, budgets, goals, and monthly cash flow.",
              "Gerencie contas, parcelas de cartão, orçamentos, metas e fluxo de caixa mensal."
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label={tr("Previous month", "Mês anterior")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[120px] px-2 text-center text-xs font-medium capitalize">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label={tr("Next month", "Próximo mês")}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideValues((h) => !h)}
            title={tr("Toggle financial privacy", "Alternar privacidade financeira")}
          >
            {hideValues ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideValues ? tr("Show Values", "Mostrar Valores") : tr("Hide Values", "Ocultar Valores")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCsvModal(true)}>
            <Upload className="h-3.5 w-3.5" /> {tr("Import CSV", "Importar CSV")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.assign("/api/finances/export?format=csv")}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {(
          [
            { id: "overview", label: tr("Overview", "Visão Geral") },
            { id: "transactions", label: tr("Transactions", "Transações") },
            { id: "accounts", label: `${tr("Accounts", "Contas")} (${data.accounts.length})` },
            { id: "cards", label: `${tr("Credit Cards", "Cartões de Crédito")} (${data.creditCards.length})` },
            { id: "budgets", label: `${tr("Budgets", "Orçamentos")} (${data.budgets.length})` },
            { id: "recurring", label: `${tr("Recurring", "Recorrências")} (${data.recurringRules.length})` },
            { id: "goals", label: `${tr("Goals", "Metas")} (${data.goals.length})` },
          ] as const
        ).map((t) => (
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

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              {tr("Available Balance", "Saldo Disponível")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {fmt(data.summary.totalAccountBalanceCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              {tr("Income", "Receitas")} ({data.month})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-emerald-500">
            {fmt(data.summary.monthIncomeCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              {tr("Expenses", "Despesas")} ({data.month})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-red-500">
            {fmt(data.summary.monthExpenseCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              {tr("Monthly Result", "Resultado Mensal")}
            </CardTitle>
          </CardHeader>
          <CardContent
            className={`text-xl font-bold ${
              data.summary.monthResultCents >= 0 ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {fmt(data.summary.monthResultCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              {tr("Open Statements", "Faturas em Aberto")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-amber-500">
            {fmt(data.summary.openStatementsTotalCents)}
          </CardContent>
        </Card>
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Income vs Expenses (Last 6 Months)", "Receitas vs Despesas (Últimos 6 Meses)")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthlySeries.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  {tr("Record transactions to view monthly cash flow.", "Registre transações para visualizar o fluxo de caixa mensal.")}
                </p>
              ) : (
                <div className="flex items-end gap-4 h-44 pt-4">
                  {data.monthlySeries.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div className="flex items-end gap-1 w-full justify-center h-32">
                        <div
                          className="w-4 rounded-t bg-emerald-500/85"
                          style={{
                            height: `${Math.max(4, Math.round((m.incomeCents / maxMonthlyBar) * 100))}%`,
                          }}
                          title={`${tr("Income", "Receita")}: ${fmt(m.incomeCents)}`}
                        />
                        <div
                          className="w-4 rounded-t bg-red-500/85"
                          style={{
                            height: `${Math.max(4, Math.round((m.expenseCents / maxMonthlyBar) * 100))}%`,
                          }}
                          title={`${tr("Expense", "Despesa")}: ${fmt(m.expenseCents)}`}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {m.month}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tr("Expenses by Category", "Despesas por Categoria")} ({data.month})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {data.expensesByCategory.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  {tr(
                    `No expenses recorded for ${data.month}.`,
                    `Nenhuma despesa registrada em ${data.month}.`
                  )}
                </p>
              ) : (
                data.expensesByCategory.slice(0, 6).map((c) => {
                  const pct =
                    data.summary.monthExpenseCents > 0
                      ? Math.round((c.amountCents / data.summary.monthExpenseCents) * 100)
                      : 0;
                  return (
                    <div key={c.categoryId} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.name}</span>
                        <span>
                          {fmt(c.amountCents)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: c.color }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {tab === "transactions" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{tr("New Transaction", "Nova Transação")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.accounts.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {tr("Create an account in the Accounts tab first.", "Crie uma conta na aba Contas primeiro.")}
                </p>
              ) : (
                <form onSubmit={handleCreateTransaction} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                  <select
                    value={txAccount || data.accounts[0]?.id || ""}
                    onChange={(e) => setTxAccount(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  >
                    {data.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as "expense" | "income")}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  >
                    <option value="expense">{tr("Expense", "Despesa")}</option>
                    <option value="income">{tr("Income", "Receita")}</option>
                  </select>
                  <Input
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    placeholder={tr("Description", "Descrição")}
                    required
                  />
                  <Input
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder={tr("Amount (e.g. 49,90)", "Valor (ex: 49,90)")}
                    required
                  />
                  <select
                    value={txCat}
                    onChange={(e) => setTxCat(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  >
                    <option value="">{tr("Category", "Categoria")}</option>
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="text-xs"
                    />
                    <Button type="submit" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-2">
              {data.transactions.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  {tr(
                    "No transactions recorded yet. Add your first income or expense above.",
                    "Nenhuma transação registrada ainda. Adicione sua primeira receita ou despesa acima."
                  )}
                </p>
              ) : (
                data.transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.description}</div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      {t.transactionDate} · {txTypeLabel(t.type)} ·{" "}
                      {t.categoryId ? catMap.get(t.categoryId)?.name ?? tr("Category", "Categoria") : tr("Uncategorized", "Sem categoria")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {txStatusLabel(t.status)}
                    </Badge>
                    <span
                      className={`font-semibold ${
                        t.type === "income" || t.type === "refund"
                          ? "text-emerald-500"
                          : "text-red-500"
                      }`}
                    >
                      {fmt(t.amountCents, t.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            tr(
                              `Delete transaction "${t.description}"?`,
                              `Excluir a transação "${t.description}"?`
                            )
                          )
                        ) {
                          return;
                        }
                        const res = await fetch(`/api/finances/transactions/${t.id}`, {
                          method: "DELETE",
                        });
                        if (res.ok) refresh();
                      }}
                      title={tr("Delete transaction", "Excluir transação")}
                      aria-label={tr("Delete transaction", "Excluir transação")}
                      className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ACCOUNTS & TRANSFERS TAB */}
      {tab === "accounts" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{tr("Accounts", "Contas")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateAccount} className="grid grid-cols-3 gap-2">
                <Input
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder={tr("Account name", "Nome da conta")}
                  required
                />
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="checking">{tr("Checking", "Conta Corrente")}</option>
                  <option value="savings">{tr("Savings", "Poupança")}</option>
                  <option value="cash">{tr("Cash", "Dinheiro")}</option>
                  <option value="wallet">{tr("Digital Wallet", "Carteira Digital")}</option>
                  <option value="investment">{tr("Investment", "Investimentos")}</option>
                </select>
                <div className="flex gap-1">
                  <Input
                    value={accInit}
                    onChange={(e) => setAccInit(e.target.value)}
                    placeholder={tr("Initial (0,00)", "Inicial (0,00)")}
                  />
                  <Button type="submit" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                {data.accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {accountTypeLabel(a.accountType)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{fmt(a.balanceCents, a.currency)}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const nextName = window.prompt(tr("Rename account:", "Renomear conta:"), a.name);
                          if (!nextName || !nextName.trim() || nextName.trim() === a.name) return;
                          const res = await fetch("/api/finances/accounts", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: a.id, name: nextName.trim() }),
                          });
                          if (res.ok) refresh();
                        }}
                        title={tr("Rename account", "Renomear conta")}
                        aria-label={tr(`Rename account ${a.name}`, `Renomear conta ${a.name}`)}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              tr(
                                `Remove account "${a.name}" from active accounts?`,
                                `Remover a conta "${a.name}" das contas ativas?`
                              )
                            )
                          ) {
                            return;
                          }
                          const res = await fetch(`/api/finances/accounts?id=${a.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) refresh();
                        }}
                        title={tr("Delete account", "Excluir conta")}
                        aria-label={tr(`Delete account ${a.name}`, `Excluir conta ${a.name}`)}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-[var(--accent)]" />
                {tr("Atomic Transfer Between Accounts", "Transferência Atômica entre Contas")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!trSrc || !trDst || !trAmount) return;
                  const amountCents = Math.abs(parseMoneyToCents(trAmount));
                  const res = await fetch("/api/finances/transfers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sourceAccountId: trSrc,
                      targetAccountId: trDst,
                      amountCents,
                      transactionDate: new Date().toISOString().slice(0, 10),
                    }),
                  });
                  if (res.ok) {
                    setTrAmount("");
                    refresh();
                  }
                }}
                className="space-y-3"
              >
                <select
                  value={trSrc}
                  onChange={(e) => setTrSrc(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="">{tr("Source account", "Conta de origem")}</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  value={trDst}
                  onChange={(e) => setTrDst(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="">{tr("Target account", "Conta de destino")}</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Input
                  value={trAmount}
                  onChange={(e) => setTrAmount(e.target.value)}
                  placeholder={tr("Amount (e.g. 500,00)", "Valor (ex: 500,00)")}
                />
                <Button type="submit" size="sm">
                  {tr("Transfer", "Transferir")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CREDIT CARDS TAB */}
      {tab === "cards" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{tr("Add Credit Card", "Adicionar Cartão de Crédito")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!cardName.trim()) return;
                    const res = await fetch("/api/finances/cards", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: cardName.trim(),
                        creditLimitCents: Math.abs(parseMoneyToCents(cardLimit || "0")),
                        closingDay: Number(cardClosing) || 10,
                        dueDay: Number(cardDue) || 17,
                      }),
                    });
                    if (res.ok) {
                      const json = await res.json();
                      if (!purchCard) setPurchCard(json.data.card.id);
                      setCardName("");
                      refresh();
                    }
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Card name", "Nome do cartão")}
                    </label>
                    <Input
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder={tr("e.g. Nubank", "Ex: Nubank")}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Credit limit", "Limite do cartão")}
                    </label>
                    <Input
                      value={cardLimit}
                      onChange={(e) => setCardLimit(e.target.value)}
                      placeholder={tr("e.g. 3000,00", "Ex: 3000,00")}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Closing day", "Dia de fechamento")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={cardClosing}
                      onChange={(e) => setCardClosing(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Due day", "Dia de vencimento")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={cardDue}
                      onChange={(e) => setCardDue(e.target.value)}
                      placeholder="17"
                    />
                  </div>
                  <Button type="submit" size="sm" className="sm:col-span-2">
                    <CreditCard className="h-4 w-4" /> {tr("Add Card", "Adicionar Cartão")}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {tr("Record Card Purchase (Installments)", "Registrar Compra no Cartão (Parcelas)")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const cid = purchCard || data.creditCards[0]?.id;
                    if (!cid || !purchDesc.trim() || !purchAmount) return;
                    const res = await fetch("/api/finances/cards/purchases", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        cardId: cid,
                        description: purchDesc.trim(),
                        totalCents: Math.abs(parseMoneyToCents(purchAmount)),
                        installmentsCount: Number(purchInstallments) || 1,
                        purchaseDate: new Date().toISOString().slice(0, 10),
                      }),
                    });
                    if (res.ok) {
                      setPurchDesc("");
                      setPurchAmount("");
                      setPurchInstallments("1");
                      refresh();
                    }
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Card", "Cartão")}
                    </label>
                    <select
                      value={purchCard || data.creditCards[0]?.id || ""}
                      onChange={(e) => setPurchCard(e.target.value)}
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                    >
                      {data.creditCards.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Description", "Descrição")}
                    </label>
                    <Input
                      value={purchDesc}
                      onChange={(e) => setPurchDesc(e.target.value)}
                      placeholder={tr("Purchase description", "Descrição da compra")}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Total amount", "Valor total")}
                    </label>
                    <Input
                      value={purchAmount}
                      onChange={(e) => setPurchAmount(e.target.value)}
                      placeholder={tr("e.g. 1200,00", "Ex: 1200,00")}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                      {tr("Installments", "Parcelas")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={48}
                      value={purchInstallments}
                      onChange={(e) => setPurchInstallments(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <Button type="submit" size="sm" className="sm:col-span-2">
                    {tr("Record Purchase", "Registrar Compra")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.creditCards.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          tr(
                            `Delete credit card "${c.name}" and its statements?`,
                            `Excluir o cartão "${c.name}" e suas faturas?`
                          )
                        )
                      ) {
                        return;
                      }
                      const res = await fetch(`/api/finances/cards?id=${c.id}`, {
                        method: "DELETE",
                      });
                      if (res.ok) refresh();
                    }}
                    title={tr("Delete card", "Excluir cartão")}
                    aria-label={tr("Delete card", "Excluir cartão")}
                    className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-2.5">
                    <div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        {tr("Limit", "Limite")}
                      </div>
                      <div className="font-semibold">{fmt(c.creditLimitCents, c.currency)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        {tr("Used", "Usado")}
                      </div>
                      <div className="font-semibold text-red-500">{fmt(c.usedLimitCents, c.currency)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        {tr("Available", "Disponível")}
                      </div>
                      <div className="font-semibold text-emerald-500">{fmt(c.availableLimitCents, c.currency)}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    {data.statements
                      .filter((s) => s.cardId === c.id)
                      .map((s) => {
                        const remaining = Math.max(0, s.totalCents - s.paidCents);
                        return (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded border border-[var(--border)] px-2.5 py-1.5"
                          >
                            <div>
                              <span className="font-medium">{s.periodKey}</span>
                              <span className="ml-2 text-[var(--muted-foreground)]">
                                {tr("Due", "Venc.")} {s.dueDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>
                                {fmt(remaining, c.currency)} / {fmt(s.totalCents, c.currency)}
                              </span>
                              <Badge variant="outline">{statementStatusLabel(s.status)}</Badge>
                              {remaining > 0 && data.accounts.length > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={async () => {
                                    const accountId = payAccount || data.accounts[0]!.id;
                                    await fetch("/api/finances/cards/pay", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        statementId: s.id,
                                        accountId,
                                        amountCents: remaining,
                                        paymentDate: new Date().toISOString().slice(0, 10),
                                      }),
                                    });
                                    refresh();
                                  }}
                                >
                                  {tr("Pay", "Pagar")}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* BUDGETS TAB */}
      {tab === "budgets" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!budName.trim() || !budLimit) return;
                  const res = await fetch("/api/finances/budgets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: budName.trim(),
                      categoryId: budCat || null,
                      limitCents: Math.abs(parseMoneyToCents(budLimit)),
                    }),
                  });
                  if (res.ok) {
                    setBudName("");
                    setBudLimit("");
                    refresh();
                  }
                }}
                className="flex flex-wrap gap-2"
              >
                <Input
                  value={budName}
                  onChange={(e) => setBudName(e.target.value)}
                  placeholder={tr("Budget name", "Nome do orçamento")}
                  required
                  className="w-48"
                />
                <select
                  value={budCat}
                  onChange={(e) => setBudCat(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="">{tr("All expenses", "Todas as despesas")}</option>
                  {data.categories
                    .filter((c) => c.kind === "expense")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <Input
                  value={budLimit}
                  onChange={(e) => setBudLimit(e.target.value)}
                  placeholder={tr("Monthly limit (e.g. 800,00)", "Limite mensal (ex: 800,00)")}
                  required
                  className="w-full sm:w-56"
                />
                <Button type="submit" size="sm">
                  <PiggyBank className="h-4 w-4" /> {tr("Create Budget", "Criar Orçamento")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.budgets.map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{b.name}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={b.percent >= 100 ? "warning" : "outline"}>
                        {b.percent}%
                      </Badge>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(tr(`Delete budget "${b.name}"?`, `Excluir o orçamento "${b.name}"?`))) return;
                          const res = await fetch(`/api/finances/budgets?id=${b.id}`, { method: "DELETE" });
                          if (res.ok) refresh();
                        }}
                        title={tr("Delete budget", "Excluir orçamento")}
                        aria-label={tr("Delete budget", "Excluir orçamento")}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        b.percent >= 100
                          ? "bg-red-500"
                          : b.percent >= 75
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, b.percent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[var(--muted-foreground)]">
                    <span>{tr("Spent:", "Gasto:")} {fmt(b.spentCents, b.currency)}</span>
                    <span>{tr("Limit:", "Limite:")} {fmt(b.limitCents, b.currency)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* RECURRING TAB */}
      {tab === "recurring" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!recName.trim() || !recAmount) return;
                  const res = await fetch("/api/finances/recurring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: recName.trim(),
                      amountCents: Math.abs(parseMoneyToCents(recAmount)),
                      accountId: data.accounts[0]?.id ?? null,
                      frequency: recFreq,
                      startDate: new Date().toISOString().slice(0, 10),
                    }),
                  });
                  if (res.ok) {
                    setRecName("");
                    setRecAmount("");
                    refresh();
                  }
                }}
                className="flex flex-wrap gap-2"
              >
                <Input
                  value={recName}
                  onChange={(e) => setRecName(e.target.value)}
                  placeholder={tr("Rule name (e.g. Internet)", "Nome da regra (ex: Internet)")}
                  required
                  className="w-48"
                />
                <Input
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  placeholder={tr("Amount (e.g. 99,90)", "Valor (ex: 99,90)")}
                  required
                  className="w-40"
                />
                <select
                  value={recFreq}
                  onChange={(e) => setRecFreq(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="monthly">{tr("Monthly", "Mensal")}</option>
                  <option value="weekly">{tr("Weekly", "Semanal")}</option>
                  <option value="annual">{tr("Annual", "Anual")}</option>
                </select>
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> {tr("Add Rule", "Adicionar Regra")}
                </Button>
              </form>

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch("/api/finances/recurring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "generate" }),
                  });
                  refresh();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> {tr("Generate Due", "Gerar Vencidas")}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {data.recurringRules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs"
              >
                <div>
                  <div className="font-medium text-sm">{r.name}</div>
                  <div className="text-[var(--muted-foreground)]">
                    {frequencyLabel(r.frequency)} · {tr("Next:", "Próxima:")} {r.nextOccurrence}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{fmt(r.amountCents, r.currency)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(tr(`Delete recurring rule "${r.name}"?`, `Excluir a regra "${r.name}"?`))) return;
                      const res = await fetch(`/api/finances/recurring?id=${r.id}`, { method: "DELETE" });
                      if (res.ok) refresh();
                    }}
                    title={tr("Delete rule", "Excluir regra")}
                    aria-label={tr("Delete rule", "Excluir regra")}
                    className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GOALS TAB */}
      {tab === "goals" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!goalName.trim() || !goalTarget) return;
                  const res = await fetch("/api/finances/goals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: goalName.trim(),
                      targetCents: Math.abs(parseMoneyToCents(goalTarget)),
                    }),
                  });
                  if (res.ok) {
                    setGoalName("");
                    setGoalTarget("");
                    refresh();
                  }
                }}
                className="flex flex-wrap gap-2"
              >
                <Input
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder={tr("Goal name (e.g. Emergency Fund)", "Nome da meta (ex: Reserva de Emergência)")}
                  required
                  className="w-full sm:w-72"
                />
                <Input
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder={tr("Target (e.g. 5000,00)", "Meta (ex: 5000,00)")}
                  required
                  className="w-full sm:w-48"
                />
                <Button type="submit" size="sm">
                  <Target className="h-4 w-4" /> {tr("Create Goal", "Criar Meta")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.goals.map((g) => {
              const pct =
                g.targetCents > 0
                  ? Math.min(100, Math.round((g.reservedCents / g.targetCents) * 100))
                  : 0;
              return (
                <Card key={g.id}>
                  <CardContent className="pt-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm">{g.name}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline">{pct}%</Badge>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(tr(`Delete goal "${g.name}"?`, `Excluir a meta "${g.name}"?`))) return;
                            const res = await fetch(`/api/finances/goals?id=${g.id}`, { method: "DELETE" });
                            if (res.ok) refresh();
                          }}
                          title={tr("Delete goal", "Excluir meta")}
                          aria-label={tr("Delete goal", "Excluir meta")}
                          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--surface-muted)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--muted-foreground)]">
                        {fmt(g.reservedCents, g.currency)} / {fmt(g.targetCents, g.currency)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={async () => {
                          const input = window.prompt(
                            tr("Contribution amount (e.g. 100,00):", "Valor da contribuição (ex: 100,00):")
                          );
                          if (!input) return;
                          const cents = Math.abs(parseMoneyToCents(input));
                          if (cents <= 0) return;
                          await fetch(`/api/finances/goals/${g.id}/contribute`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ amountCents: cents, kind: "contribution" }),
                          });
                          refresh();
                        }}
                      >
                        {tr("+ Contribute", "+ Contribuir")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowCsvModal(false)}
        >
          <form
            className="w-full max-w-lg space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCsvImport}
          >
            <h2 className="text-base font-semibold">
              {tr("Import Transactions (CSV)", "Importar Transações (CSV)")}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {tr("Format:", "Formato:")}{" "}
              <code>{tr("YYYY-MM-DD;Description;Amount", "AAAA-MM-DD;Descrição;Valor")}</code>{" "}
              {tr("or", "ou")}{" "}
              <code>date,title,&quot;amount&quot;</code> (Nubank).
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={csvAccount || data.accounts[0]?.id || ""}
                onChange={(e) => setCsvAccount(e.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
              >
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={csvExpenseSign}
                onChange={(e) => setCsvExpenseSign(e.target.value as "negative" | "positive")}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                aria-label={tr("Expense sign in CSV", "Sinal das despesas no CSV")}
              >
                <option value="negative">
                  {tr("Expenses are negative (-25.00)", "Despesas com valor negativo (-25,00)")}
                </option>
                <option value="positive">
                  {tr("Expenses are positive (Nubank 25,00)", "Despesas com valor positivo (Nubank 25,00)")}
                </option>
              </select>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setCsvFile(null);
                  return;
                }
                if (file.size > MAX_CSV_UPLOAD_BYTES) {
                  setCsvStatus(tr("CSV file exceeds 5 MB limit.", "O arquivo CSV excede o limite de 5 MB."));
                  setCsvFile(null);
                  return;
                }
                try {
                  const buf = new Uint8Array(await file.arrayBuffer());
                  const clean = sanitizeCsvText(buf);
                  setCsvFile(file);
                  setCsvText(clean);
                  setCsvStatus(null);
                } catch (err) {
                  setCsvStatus(
                    err instanceof Error ? err.message : tr("Invalid CSV file.", "Arquivo CSV inválido.")
                  );
                  setCsvFile(null);
                }
              }}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--background)] file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvFile(null);
                setCsvText(e.target.value);
              }}
              placeholder={tr(
                "2026-11-01;Salary;5000.00\n2026-11-02;Groceries;-250.40",
                "2026-11-01;Salário;5000,00\n2026-11-02;Mercado;-250,40"
              )}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-xs"
            />
            {csvStatus && <p className="text-xs text-emerald-500">{csvStatus}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCsvModal(false)}
              >
                {tr("Close", "Fechar")}
              </Button>
              <Button type="submit" size="sm">
                {tr("Import", "Importar")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
