"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Target,
  Upload,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [month, setMonth] = useState(initialData.month);
  const [hideValues, setHideValues] = useState(initialHideValues);

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
  const [csvText, setCsvText] = useState("");
  const [csvAccount, setCsvAccount] = useState(initialData.accounts[0]?.id ?? "");
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
    if (!accountId || !csvText.trim()) return;

    const lines = csvText
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
      const parts = line.split(/[;,]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 3) continue;
      const [dateRaw, descRaw, amountRaw] = parts;
      if (!dateRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) continue;
      try {
        const cents = parseMoneyToCents(amountRaw!);
        parsedRows.push({
          date: dateRaw,
          description: descRaw || "Imported",
          amountCents: Math.abs(cents),
          type: cents >= 0 ? "income" : "expense",
        });
      } catch {
        // skip invalid line
      }
    }

    if (parsedRows.length === 0) {
      setCsvStatus("No valid rows found (expected: YYYY-MM-DD;Description;Amount).");
      return;
    }

    const res = await fetch("/api/finances/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        filename: "manual-import.csv",
        rows: parsedRows,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setCsvStatus(
        `Imported ${json.data.imported} rows (${json.data.skipped} duplicates skipped).`
      );
      setCsvText("");
      refresh();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-[var(--accent)]" />
            Personal Finances
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Integer-cent accounts, credit card installments, budgets, goals, and cash flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 w-40 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideValues((h) => !h)}
            title="Toggle financial privacy"
          >
            {hideValues ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideValues ? "Show Values" : "Hide Values"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCsvModal(true)}>
            <Upload className="h-3.5 w-3.5" /> Import CSV
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
            { id: "overview", label: "Overview" },
            { id: "transactions", label: "Transactions" },
            { id: "accounts", label: `Accounts (${data.accounts.length})` },
            { id: "cards", label: `Credit Cards (${data.creditCards.length})` },
            { id: "budgets", label: `Budgets (${data.budgets.length})` },
            { id: "recurring", label: `Recurring (${data.recurringRules.length})` },
            { id: "goals", label: `Goals (${data.goals.length})` },
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
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {fmt(data.summary.totalAccountBalanceCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              Income ({data.month})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-emerald-500">
            {fmt(data.summary.monthIncomeCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              Expenses ({data.month})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold text-red-500">
            {fmt(data.summary.monthExpenseCents)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-[var(--muted-foreground)]">
              Monthly Result
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
              Open Statements
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
              <CardTitle className="text-base">Income vs Expenses (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.monthlySeries.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  Record transactions to view monthly cash flow.
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
                          title={`Income: ${fmt(m.incomeCents)}`}
                        />
                        <div
                          className="w-4 rounded-t bg-red-500/85"
                          style={{
                            height: `${Math.max(4, Math.round((m.expenseCents / maxMonthlyBar) * 100))}%`,
                          }}
                          title={`Expense: ${fmt(m.expenseCents)}`}
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
              <CardTitle className="text-base">Expenses by Category ({data.month})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {data.expensesByCategory.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  No expenses recorded for {data.month}.
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
              <CardTitle className="text-base">New Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              {data.accounts.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Create an account in the Accounts tab first.
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
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <Input
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    placeholder="Description"
                    required
                  />
                  <Input
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="Amount (e.g. 49,90)"
                    required
                  />
                  <select
                    value={txCat}
                    onChange={(e) => setTxCat(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  >
                    <option value="">Category</option>
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
                  No transactions recorded yet. Add your first income or expense above.
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
                      {t.transactionDate} · {t.type} ·{" "}
                      {t.categoryId ? catMap.get(t.categoryId)?.name ?? "Category" : "Uncategorized"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {t.status}
                    </Badge>
                    <span
                      className={`font-semibold ${
                        t.type === "income" || t.type === "refund"
                          ? "text-emerald-500"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {fmt(t.amountCents, t.currency)}
                    </span>
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
              <CardTitle className="text-base">Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleCreateAccount} className="grid grid-cols-3 gap-2">
                <Input
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Account name"
                  required
                />
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="cash">Cash</option>
                  <option value="wallet">Digital Wallet</option>
                  <option value="investment">Investment</option>
                </select>
                <div className="flex gap-1">
                  <Input
                    value={accInit}
                    onChange={(e) => setAccInit(e.target.value)}
                    placeholder="Initial (0,00)"
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
                      <div className="text-xs text-[var(--muted-foreground)] capitalize">
                        {a.accountType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{fmt(a.balanceCents, a.currency)}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const nextName = window.prompt("Rename account:", a.name);
                          if (!nextName || !nextName.trim() || nextName.trim() === a.name) return;
                          const res = await fetch("/api/finances/accounts", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: a.id, name: nextName.trim() }),
                          });
                          if (res.ok) refresh();
                        }}
                        title="Rename account"
                        aria-label={`Rename account ${a.name}`}
                        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
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
                Atomic Transfer Between Accounts
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
                  <option value="">Source account</option>
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
                  <option value="">Target account</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Input
                  value={trAmount}
                  onChange={(e) => setTrAmount(e.target.value)}
                  placeholder="Amount (e.g. 500,00)"
                />
                <Button type="submit" size="sm">
                  Transfer
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
                <CardTitle className="text-base">Add Credit Card</CardTitle>
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
                  className="grid grid-cols-2 gap-2"
                >
                  <Input
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Card name"
                    required
                  />
                  <Input
                    value={cardLimit}
                    onChange={(e) => setCardLimit(e.target.value)}
                    placeholder="Limit (e.g. 3000,00)"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={cardClosing}
                    onChange={(e) => setCardClosing(e.target.value)}
                    placeholder="Closing day"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={cardDue}
                    onChange={(e) => setCardDue(e.target.value)}
                    placeholder="Due day"
                  />
                  <Button type="submit" size="sm" className="col-span-2">
                    <CreditCard className="h-4 w-4" /> Add Card
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Card Purchase (Installments)</CardTitle>
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
                  className="grid grid-cols-2 gap-2"
                >
                  <select
                    value={purchCard || data.creditCards[0]?.id || ""}
                    onChange={(e) => setPurchCard(e.target.value)}
                    className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  >
                    {data.creditCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={purchDesc}
                    onChange={(e) => setPurchDesc(e.target.value)}
                    placeholder="Purchase description"
                    required
                  />
                  <Input
                    value={purchAmount}
                    onChange={(e) => setPurchAmount(e.target.value)}
                    placeholder="Total (e.g. 1200,00)"
                    required
                  />
                  <Input
                    type="number"
                    min={1}
                    max={48}
                    value={purchInstallments}
                    onChange={(e) => setPurchInstallments(e.target.value)}
                    placeholder="Installments"
                  />
                  <Button type="submit" size="sm" className="col-span-2">
                    Record Purchase
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.creditCards.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Limit: {fmt(c.creditLimitCents, c.currency)}</span>
                    <span>Used: {fmt(c.usedLimitCents, c.currency)}</span>
                    <span>Available: {fmt(c.availableLimitCents, c.currency)}</span>
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
                                Due {s.dueDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>
                                {fmt(remaining, c.currency)} / {fmt(s.totalCents, c.currency)}
                              </span>
                              <Badge variant="outline">{s.status}</Badge>
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
                                  Pay
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
                  placeholder="Budget name"
                  required
                  className="w-48"
                />
                <select
                  value={budCat}
                  onChange={(e) => setBudCat(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="">All expenses</option>
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
                  placeholder="Monthly limit (e.g. 800,00)"
                  required
                  className="w-48"
                />
                <Button type="submit" size="sm">
                  <PiggyBank className="h-4 w-4" /> Create Budget
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.budgets.map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{b.name}</span>
                    <Badge variant={b.percent >= 100 ? "warning" : "outline"}>
                      {b.percent}%
                    </Badge>
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
                    <span>Spent: {fmt(b.spentCents, b.currency)}</span>
                    <span>Limit: {fmt(b.limitCents, b.currency)}</span>
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
                  placeholder="Rule name (e.g. Internet)"
                  required
                  className="w-48"
                />
                <Input
                  value={recAmount}
                  onChange={(e) => setRecAmount(e.target.value)}
                  placeholder="Amount (e.g. 99,90)"
                  required
                  className="w-40"
                />
                <select
                  value={recFreq}
                  onChange={(e) => setRecFreq(e.target.value)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="annual">Annual</option>
                </select>
                <Button type="submit" size="sm">
                  <Plus className="h-4 w-4" /> Add Rule
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
                <RefreshCw className="h-3.5 w-3.5" /> Generate Due
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
                    {r.frequency} · Next: {r.nextOccurrence}
                  </div>
                </div>
                <span className="font-semibold">{fmt(r.amountCents, r.currency)}</span>
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
                  placeholder="Goal name (e.g. Emergency Fund)"
                  required
                  className="w-full sm:w-72"
                />
                <Input
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="Target (e.g. 5000,00)"
                  required
                  className="w-full sm:w-48"
                />
                <Button type="submit" size="sm">
                  <Target className="h-4 w-4" /> Create Goal
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
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{g.name}</span>
                      <Badge variant="outline">{pct}%</Badge>
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
                          const input = window.prompt("Contribution amount (e.g. 100,00):");
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
                        + Contribute
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
            <h2 className="text-base font-semibold">Import Transactions (CSV)</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Format: <code>YYYY-MM-DD;Description;Amount</code> (negative for expenses).
            </p>
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
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"2026-11-01;Salário;5000,00\n2026-11-02;Mercado;-250,40"}
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
                Close
              </Button>
              <Button type="submit" size="sm">
                Import
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
