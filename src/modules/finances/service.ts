import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { withUserRls } from "@/db/rls";
import {
  financeAccounts,
  financeBudgets,
  financeCardPurchases,
  financeCategories,
  financeCreditCards,
  financeGoalContributions,
  financeGoals,
  financeImportBatches,
  financeInstallments,
  financeRecurringRules,
  financeStatements,
  financeTransactions,
  financeTransactionSplits,
} from "@/db/schema";
import { computeStatementPeriod, splitInstallmentsCents } from "./money";

export class FinanceServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

const DEFAULT_CATEGORIES: Array<{ name: string; kind: "income" | "expense"; color: string }> = [
  { name: "Salário", kind: "income", color: "#10b981" },
  { name: "Freelance", kind: "income", color: "#06b6d4" },
  { name: "Reembolso", kind: "income", color: "#3b82f6" },
  { name: "Alimentação", kind: "expense", color: "#f97316" },
  { name: "Transporte", kind: "expense", color: "#eab308" },
  { name: "Moradia", kind: "expense", color: "#8b5cf6" },
  { name: "Educação", kind: "expense", color: "#3b82f6" },
  { name: "Assinaturas", kind: "expense", color: "#ec4899" },
  { name: "Saúde", kind: "expense", color: "#ef4444" },
  { name: "Lazer", kind: "expense", color: "#14b8a6" },
  { name: "Outros", kind: "expense", color: "#64748b" },
];

export async function getFinanceOverview(params: {
  userId: string;
  workspaceId: string;
  month?: string; // YYYY-MM
  accountId?: string;
  categoryId?: string;
}) {
  const now = new Date();
  const targetMonth =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${targetMonth}-01`;
  const monthEnd = `${targetMonth}-31`;

  return withUserRls(params.userId, async (tx) => {
    let categoryRows = await tx
      .select()
      .from(financeCategories)
      .where(
        and(
          eq(financeCategories.userId, params.userId),
          eq(financeCategories.workspaceId, params.workspaceId)
        )
      )
      .orderBy(asc(financeCategories.sortOrder), asc(financeCategories.name));

    if (categoryRows.length === 0) {
      categoryRows = await tx
        .insert(financeCategories)
        .values(
          DEFAULT_CATEGORIES.map((c, idx) => ({
            userId: params.userId,
            workspaceId: params.workspaceId,
            name: c.name,
            kind: c.kind,
            color: c.color,
            sortOrder: idx,
          }))
        )
        .returning();
    }

    const [
      accountRows,
      allTxRows,
      cardRows,
      statementRows,
      purchaseRows,
      installmentRows,
      budgetRows,
      recurringRows,
      goalRows,
      splitRows,
    ] = await Promise.all([
      tx
        .select()
        .from(financeAccounts)
        .where(
          and(
            eq(financeAccounts.userId, params.userId),
            eq(financeAccounts.workspaceId, params.workspaceId)
          )
        )
        .orderBy(asc(financeAccounts.name)),
      tx
        .select()
        .from(financeTransactions)
        .where(
          and(
            eq(financeTransactions.userId, params.userId),
            eq(financeTransactions.workspaceId, params.workspaceId)
          )
        )
        .orderBy(desc(financeTransactions.transactionDate), desc(financeTransactions.createdAt)),
      tx
        .select()
        .from(financeCreditCards)
        .where(
          and(
            eq(financeCreditCards.userId, params.userId),
            eq(financeCreditCards.workspaceId, params.workspaceId)
          )
        )
        .orderBy(asc(financeCreditCards.name)),
      tx
        .select()
        .from(financeStatements)
        .where(
          and(
            eq(financeStatements.userId, params.userId),
            eq(financeStatements.workspaceId, params.workspaceId)
          )
        )
        .orderBy(asc(financeStatements.dueDate)),
      tx
        .select()
        .from(financeCardPurchases)
        .where(
          and(
            eq(financeCardPurchases.userId, params.userId),
            eq(financeCardPurchases.workspaceId, params.workspaceId)
          )
        )
        .orderBy(desc(financeCardPurchases.purchaseDate))
        .limit(50),
      tx
        .select()
        .from(financeInstallments)
        .where(eq(financeInstallments.userId, params.userId))
        .orderBy(asc(financeInstallments.dueDate)),
      tx
        .select()
        .from(financeBudgets)
        .where(
          and(
            eq(financeBudgets.userId, params.userId),
            eq(financeBudgets.workspaceId, params.workspaceId),
            eq(financeBudgets.status, "active")
          )
        ),
      tx
        .select()
        .from(financeRecurringRules)
        .where(
          and(
            eq(financeRecurringRules.userId, params.userId),
            eq(financeRecurringRules.workspaceId, params.workspaceId)
          )
        )
        .orderBy(asc(financeRecurringRules.nextOccurrence)),
      tx
        .select()
        .from(financeGoals)
        .where(
          and(
            eq(financeGoals.userId, params.userId),
            eq(financeGoals.workspaceId, params.workspaceId),
            eq(financeGoals.status, "active")
          )
        ),
      tx
        .select()
        .from(financeTransactionSplits)
        .where(eq(financeTransactionSplits.userId, params.userId)),
    ]);

    // Derive exact account balances from initialBalanceCents + confirmed transactions
    const accountBalances = new Map<string, number>();
    for (const acc of accountRows) {
      accountBalances.set(acc.id, acc.initialBalanceCents);
    }

    for (const t of allTxRows) {
      if (t.status !== "confirmed") continue;
      if (t.accountId) {
        const cur = accountBalances.get(t.accountId) ?? 0;
        if (t.type === "income" || t.type === "refund") {
          accountBalances.set(t.accountId, cur + t.amountCents);
        } else if (t.type === "expense" || t.type === "card_payment") {
          accountBalances.set(t.accountId, cur - t.amountCents);
        } else if (t.type === "adjustment") {
          accountBalances.set(t.accountId, cur + t.amountCents);
        } else if (t.type === "transfer") {
          accountBalances.set(t.accountId, cur - t.amountCents - t.feeCents);
        }
      }
      if (t.type === "transfer" && t.targetAccountId) {
        const targetCur = accountBalances.get(t.targetAccountId) ?? 0;
        accountBalances.set(t.targetAccountId, targetCur + t.amountCents);
      }
    }

    const accountsWithBalance = accountRows.map((acc) => ({
      ...acc,
      balanceCents: accountBalances.get(acc.id) ?? acc.initialBalanceCents,
    }));

    const totalAccountBalanceCents = accountsWithBalance
      .filter((a) => a.status === "active")
      .reduce((sum, a) => sum + a.balanceCents, 0);

    // Filter transactions for the requested period/account/category
    const monthConfirmedTx = allTxRows.filter(
      (t) =>
        t.status === "confirmed" &&
        t.transactionDate >= monthStart &&
        t.transactionDate <= monthEnd &&
        (!params.accountId || t.accountId === params.accountId) &&
        (!params.categoryId || t.categoryId === params.categoryId)
    );

    const monthIncomeCents = monthConfirmedTx
      .filter((t) => t.type === "income" || t.type === "refund")
      .reduce((sum, t) => sum + t.amountCents, 0);

    const monthDirectExpenseCents = monthConfirmedTx
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Credit card purchases in the month count as expenses (whereas card_payment does NOT)
    const monthCardExpenseCents = purchaseRows
      .filter(
        (p) =>
          p.status === "confirmed" &&
          p.purchaseDate >= monthStart &&
          p.purchaseDate <= monthEnd &&
          (!params.categoryId || p.categoryId === params.categoryId)
      )
      .reduce((sum, p) => sum + p.totalCents, 0);

    const monthExpenseCents = monthDirectExpenseCents + monthCardExpenseCents;

    const pendingCents = allTxRows
      .filter((t) => t.status === "pending")
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Card limits & open statements
    const cardsWithUsage = cardRows.map((card) => {
      const cardStatements = statementRows.filter((s) => s.cardId === card.id);
      const unpaidCents = cardStatements
        .filter((s) => s.status !== "paid")
        .reduce((sum, s) => sum + Math.max(0, s.totalCents - s.paidCents), 0);
      return {
        ...card,
        usedLimitCents: unpaidCents,
        availableLimitCents: Math.max(0, card.creditLimitCents - unpaidCents),
      };
    });

    const openStatementsTotalCents = statementRows
      .filter((s) => s.status !== "paid" && s.periodKey <= targetMonth)
      .reduce((sum, s) => sum + Math.max(0, s.totalCents - s.paidCents), 0);

    // Expenses by category (respecting splits without double counting)
    const splitsByTx = new Map<string, typeof splitRows>();
    for (const sp of splitRows) {
      const arr = splitsByTx.get(sp.transactionId) ?? [];
      arr.push(sp);
      splitsByTx.set(sp.transactionId, arr);
    }

    const catSpendMap = new Map<string, number>();
    for (const t of monthConfirmedTx) {
      if (t.type !== "expense") continue;
      const txSplits = splitsByTx.get(t.id);
      if (txSplits && txSplits.length > 0) {
        for (const sp of txSplits) {
          const cid = sp.categoryId ?? "uncategorized";
          catSpendMap.set(cid, (catSpendMap.get(cid) ?? 0) + sp.amountCents);
        }
      } else {
        const cid = t.categoryId ?? "uncategorized";
        catSpendMap.set(cid, (catSpendMap.get(cid) ?? 0) + t.amountCents);
      }
    }
    for (const p of purchaseRows) {
      if (
        p.status === "confirmed" &&
        p.purchaseDate >= monthStart &&
        p.purchaseDate <= monthEnd
      ) {
        const cid = p.categoryId ?? "uncategorized";
        catSpendMap.set(cid, (catSpendMap.get(cid) ?? 0) + p.totalCents);
      }
    }

    const catById = new Map(categoryRows.map((c) => [c.id, c]));
    const expensesByCategory = Array.from(catSpendMap.entries())
      .map(([categoryId, amountCents]) => {
        const cat = catById.get(categoryId);
        return {
          categoryId,
          name: cat?.name ?? "Sem categoria",
          color: cat?.color ?? "#64748b",
          amountCents,
        };
      })
      .sort((a, b) => b.amountCents - a.amountCents);

    // Budget consumption
    const budgetsWithProgress = budgetRows.map((b) => {
      const spentCents = b.categoryId
        ? catSpendMap.get(b.categoryId) ?? 0
        : monthExpenseCents;
      const percent = b.limitCents > 0 ? Math.round((spentCents / b.limitCents) * 1000) / 10 : 0;
      return {
        ...b,
        spentCents,
        remainingCents: b.limitCents - spentCents,
        percent,
      };
    });

    // Monthly series (last 6 months)
    const monthlyMap = new Map<string, { incomeCents: number; expenseCents: number }>();
    for (const t of allTxRows) {
      if (t.status !== "confirmed") continue;
      const mKey = t.transactionDate.slice(0, 7);
      const cur = monthlyMap.get(mKey) ?? { incomeCents: 0, expenseCents: 0 };
      if (t.type === "income" || t.type === "refund") cur.incomeCents += t.amountCents;
      if (t.type === "expense") cur.expenseCents += t.amountCents;
      monthlyMap.set(mKey, cur);
    }
    for (const p of purchaseRows) {
      if (p.status !== "confirmed") continue;
      const mKey = p.purchaseDate.slice(0, 7);
      const cur = monthlyMap.get(mKey) ?? { incomeCents: 0, expenseCents: 0 };
      cur.expenseCents += p.totalCents;
      monthlyMap.set(mKey, cur);
    }
    const monthlySeries = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({ month, ...v }));

    return {
      month: targetMonth,
      summary: {
        totalAccountBalanceCents,
        monthIncomeCents,
        monthExpenseCents,
        monthResultCents: monthIncomeCents - monthExpenseCents,
        openStatementsTotalCents,
        pendingCents,
      },
      accounts: accountsWithBalance,
      categories: categoryRows,
      transactions: allTxRows.slice(0, 100),
      creditCards: cardsWithUsage,
      statements: statementRows,
      installments: installmentRows.slice(0, 100),
      budgets: budgetsWithProgress,
      recurringRules: recurringRows,
      goals: goalRows,
      expensesByCategory,
      monthlySeries,
    };
  });
}

export async function createAccount(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    accountType: string;
    institution?: string | null;
    color: string;
    icon: string;
    currency: string;
    initialBalanceCents: number;
    balanceReferenceDate?: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(financeAccounts)
      .values({
        userId,
        workspaceId,
        name: input.name,
        accountType: input.accountType,
        institution: input.institution ?? null,
        color: input.color,
        icon: input.icon,
        currency: input.currency,
        initialBalanceCents: input.initialBalanceCents,
        balanceReferenceDate:
          input.balanceReferenceDate ?? new Date().toISOString().slice(0, 10),
      })
      .returning();
    return created!;
  });
}

export async function archiveAccount(userId: string, accountId: string) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(financeAccounts)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, userId)))
      .returning();
    if (!updated) throw new FinanceServiceError(404, "NOT_FOUND", "Account not found");
    return updated;
  });
}

export async function createCategory(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    kind: "income" | "expense";
    parentId?: string | null;
    color: string;
    icon: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(financeCategories)
      .values({
        userId,
        workspaceId,
        name: input.name,
        kind: input.kind,
        parentId: input.parentId ?? null,
        color: input.color,
        icon: input.icon,
      })
      .returning();
    return created!;
  });
}

export async function createTransaction(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    categoryId?: string | null;
    type: "income" | "expense" | "adjustment" | "refund";
    status: "pending" | "confirmed" | "canceled";
    amountCents: number;
    currency: string;
    description: string;
    transactionDate: string;
    notes?: string | null;
    tags?: string[];
    splits?: Array<{ categoryId?: string | null; amountCents: number; description?: string | null }>;
  }
) {
  if (input.splits && input.splits.length > 0) {
    const splitTotal = input.splits.reduce((sum, s) => sum + s.amountCents, 0);
    if (splitTotal !== input.amountCents) {
      throw new FinanceServiceError(
        400,
        "SPLIT_MISMATCH",
        "Sum of split amounts must equal the transaction total"
      );
    }
  }

  return withUserRls(userId, async (tx) => {
    const [acc] = await tx
      .select({ id: financeAccounts.id })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, input.accountId), eq(financeAccounts.userId, userId)))
      .limit(1);
    if (!acc) throw new FinanceServiceError(404, "ACCOUNT_NOT_FOUND", "Account not found");

    const [created] = await tx
      .insert(financeTransactions)
      .values({
        userId,
        workspaceId,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        type: input.type,
        status: input.status,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description,
        transactionDate: input.transactionDate,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
      })
      .returning();

    if (input.splits && input.splits.length > 0 && created) {
      await tx.insert(financeTransactionSplits).values(
        input.splits.map((s) => ({
          userId,
          transactionId: created.id,
          categoryId: s.categoryId ?? null,
          amountCents: s.amountCents,
          description: s.description ?? null,
        }))
      );
    }

    return created!;
  });
}

export async function updateTransactionStatus(
  userId: string,
  transactionId: string,
  status: "pending" | "confirmed" | "canceled"
) {
  return withUserRls(userId, async (tx) => {
    const [updated] = await tx
      .update(financeTransactions)
      .set({ status, updatedAt: new Date() })
      .where(
        and(eq(financeTransactions.id, transactionId), eq(financeTransactions.userId, userId))
      )
      .returning();
    if (!updated) throw new FinanceServiceError(404, "NOT_FOUND", "Transaction not found");
    return updated;
  });
}

export async function createTransfer(
  userId: string,
  workspaceId: string,
  input: {
    sourceAccountId: string;
    targetAccountId: string;
    amountCents: number;
    feeCents: number;
    description: string;
    transactionDate: string;
  }
) {
  if (input.sourceAccountId === input.targetAccountId) {
    throw new FinanceServiceError(400, "SAME_ACCOUNT", "Source and target accounts must differ");
  }

  return withUserRls(userId, async (tx) => {
    const [src, dst] = await Promise.all([
      tx
        .select({ id: financeAccounts.id, currency: financeAccounts.currency })
        .from(financeAccounts)
        .where(
          and(eq(financeAccounts.id, input.sourceAccountId), eq(financeAccounts.userId, userId))
        )
        .limit(1),
      tx
        .select({ id: financeAccounts.id, currency: financeAccounts.currency })
        .from(financeAccounts)
        .where(
          and(eq(financeAccounts.id, input.targetAccountId), eq(financeAccounts.userId, userId))
        )
        .limit(1),
    ]);

    if (!src[0] || !dst[0]) {
      throw new FinanceServiceError(404, "ACCOUNT_NOT_FOUND", "Source or target account not found");
    }

    const [created] = await tx
      .insert(financeTransactions)
      .values({
        userId,
        workspaceId,
        accountId: input.sourceAccountId,
        targetAccountId: input.targetAccountId,
        type: "transfer",
        status: "confirmed",
        amountCents: input.amountCents,
        feeCents: input.feeCents,
        currency: src[0].currency,
        description: input.description,
        transactionDate: input.transactionDate,
      })
      .returning();

    return created!;
  });
}

export async function createCreditCard(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    institution: string;
    last4?: string | null;
    brand?: string | null;
    creditLimitCents: number;
    currency: string;
    closingDay: number;
    dueDay: number;
    paymentAccountId?: string | null;
    color: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(financeCreditCards)
      .values({
        userId,
        workspaceId,
        name: input.name,
        institution: input.institution,
        last4: input.last4 ?? null,
        brand: input.brand ?? null,
        creditLimitCents: input.creditLimitCents,
        currency: input.currency,
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        paymentAccountId: input.paymentAccountId ?? null,
        color: input.color,
      })
      .returning();
    return created!;
  });
}

export async function createCardPurchase(
  userId: string,
  workspaceId: string,
  input: {
    cardId: string;
    categoryId?: string | null;
    description: string;
    totalCents: number;
    installmentsCount: number;
    purchaseDate: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [card] = await tx
      .select()
      .from(financeCreditCards)
      .where(and(eq(financeCreditCards.id, input.cardId), eq(financeCreditCards.userId, userId)))
      .limit(1);
    if (!card) throw new FinanceServiceError(404, "CARD_NOT_FOUND", "Credit card not found");

    const [purchase] = await tx
      .insert(financeCardPurchases)
      .values({
        userId,
        workspaceId,
        cardId: card.id,
        categoryId: input.categoryId ?? null,
        description: input.description,
        totalCents: input.totalCents,
        installmentsCount: input.installmentsCount,
        purchaseDate: input.purchaseDate,
        status: "confirmed",
      })
      .returning();

    const parts = splitInstallmentsCents(input.totalCents, input.installmentsCount);
    const createdInstallments = [];

    for (let i = 0; i < parts.length; i++) {
      const amountCents = parts[i]!;
      const { periodKey, closingDate, dueDate } = computeStatementPeriod(
        input.purchaseDate,
        card.closingDay,
        card.dueDay,
        i
      );

      let [stmt] = await tx
        .select()
        .from(financeStatements)
        .where(
          and(
            eq(financeStatements.cardId, card.id),
            eq(financeStatements.periodKey, periodKey)
          )
        )
        .limit(1);

      if (!stmt) {
        [stmt] = await tx
          .insert(financeStatements)
          .values({
            userId,
            workspaceId,
            cardId: card.id,
            periodKey,
            closingDate,
            dueDate,
            totalCents: 0,
            paidCents: 0,
            status: "open",
          })
          .returning();
      }

      const [inst] = await tx
        .insert(financeInstallments)
        .values({
          userId,
          purchaseId: purchase!.id,
          cardId: card.id,
          statementId: stmt!.id,
          installmentNumber: i + 1,
          totalInstallments: parts.length,
          amountCents,
          dueDate,
          status: i === 0 ? "posted" : "scheduled",
        })
        .returning();

      createdInstallments.push(inst);

      await tx
        .update(financeStatements)
        .set({
          totalCents: sql`${financeStatements.totalCents} + ${amountCents}`,
          updatedAt: new Date(),
        })
        .where(eq(financeStatements.id, stmt!.id));
    }

    return { purchase: purchase!, installments: createdInstallments };
  });
}

export async function payStatement(
  userId: string,
  workspaceId: string,
  input: {
    statementId: string;
    accountId: string;
    amountCents: number;
    paymentDate: string;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [stmt] = await tx
      .select()
      .from(financeStatements)
      .where(
        and(eq(financeStatements.id, input.statementId), eq(financeStatements.userId, userId))
      )
      .limit(1);
    if (!stmt) throw new FinanceServiceError(404, "NOT_FOUND", "Statement not found");

    const [acc] = await tx
      .select()
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, input.accountId), eq(financeAccounts.userId, userId)))
      .limit(1);
    if (!acc) throw new FinanceServiceError(404, "ACCOUNT_NOT_FOUND", "Payment account not found");

    const newPaidCents = stmt.paidCents + input.amountCents;
    const newStatus = newPaidCents >= stmt.totalCents ? "paid" : "partially_paid";

    const [updatedStmt] = await tx
      .update(financeStatements)
      .set({
        paidCents: newPaidCents,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(financeStatements.id, stmt.id))
      .returning();

    if (newStatus === "paid") {
      await tx
        .update(financeInstallments)
        .set({ status: "paid" })
        .where(eq(financeInstallments.statementId, stmt.id));
    }

    // Record account outflow as card_payment (NOT counted as a second expense)
    const [paymentTx] = await tx
      .insert(financeTransactions)
      .values({
        userId,
        workspaceId,
        accountId: input.accountId,
        cardId: stmt.cardId,
        statementId: stmt.id,
        type: "card_payment",
        status: "confirmed",
        amountCents: input.amountCents,
        currency: acc.currency,
        description: `Pagamento fatura ${stmt.periodKey}`,
        transactionDate: input.paymentDate,
      })
      .returning();

    return { statement: updatedStmt!, transaction: paymentTx! };
  });
}

export async function createBudget(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    categoryId?: string | null;
    period: "weekly" | "monthly" | "annual" | "custom";
    limitCents: number;
    currency: string;
    rolloverEnabled: boolean;
    alertThresholds: number[];
    startDate?: string | null;
    endDate?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(financeBudgets)
      .values({
        userId,
        workspaceId,
        name: input.name,
        categoryId: input.categoryId ?? null,
        period: input.period,
        limitCents: input.limitCents,
        currency: input.currency,
        rolloverEnabled: input.rolloverEnabled,
        alertThresholds: input.alertThresholds,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
      })
      .returning();
    return created!;
  });
}

function advanceDate(dateStr: string, frequency: string, intervalValue: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (frequency === "daily") d.setUTCDate(d.getUTCDate() + intervalValue);
  else if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7 * intervalValue);
  else if (frequency === "annual") d.setUTCFullYear(d.getUTCFullYear() + intervalValue);
  else d.setUTCMonth(d.getUTCMonth() + intervalValue);
  return d.toISOString().slice(0, 10);
}

export async function createRecurringRule(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    type: "income" | "expense";
    amountCents: number;
    currency: string;
    accountId?: string | null;
    categoryId?: string | null;
    frequency: string;
    intervalValue: number;
    startDate: string;
    endDate?: string | null;
    autoConfirm: boolean;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(financeRecurringRules)
      .values({
        userId,
        workspaceId,
        name: input.name,
        type: input.type,
        amountCents: input.amountCents,
        currency: input.currency,
        accountId: input.accountId ?? null,
        categoryId: input.categoryId ?? null,
        frequency: input.frequency,
        intervalValue: input.intervalValue,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        nextOccurrence: input.startDate,
        autoConfirm: input.autoConfirm,
      })
      .returning();
    return created!;
  });
}

export async function generateDueRecurringTransactions(
  userId: string,
  workspaceId: string,
  upToDate?: string
) {
  const cutoff = upToDate ?? new Date().toISOString().slice(0, 10);
  return withUserRls(userId, async (tx) => {
    const rules = await tx
      .select()
      .from(financeRecurringRules)
      .where(
        and(
          eq(financeRecurringRules.userId, userId),
          eq(financeRecurringRules.workspaceId, workspaceId),
          eq(financeRecurringRules.status, "active"),
          lte(financeRecurringRules.nextOccurrence, cutoff)
        )
      );

    let generated = 0;
    for (const rule of rules) {
      if (!rule.accountId) continue;
      let cursor = rule.nextOccurrence;
      let guard = 0;
      while (cursor <= cutoff && (!rule.endDate || cursor <= rule.endDate) && guard < 12) {
        await tx
          .insert(financeTransactions)
          .values({
            userId,
            workspaceId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            type: rule.type,
            status: rule.autoConfirm ? "confirmed" : "pending",
            amountCents: rule.amountCents,
            currency: rule.currency,
            description: rule.name,
            transactionDate: cursor,
            recurringRuleId: rule.id,
            recurrenceOccurrenceKey: cursor,
          })
          .onConflictDoNothing();
        generated++;
        cursor = advanceDate(cursor, rule.frequency, rule.intervalValue);
        guard++;
      }

      await tx
        .update(financeRecurringRules)
        .set({ nextOccurrence: cursor, updatedAt: new Date() })
        .where(eq(financeRecurringRules.id, rule.id));
    }

    return { generated };
  });
}

export async function createGoal(
  userId: string,
  workspaceId: string,
  input: {
    name: string;
    description?: string | null;
    targetCents: number;
    currency: string;
    deadline?: string | null;
    category?: string | null;
    color: string;
    linkedAccountId?: string | null;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [created] = await tx
      .insert(financeGoals)
      .values({
        userId,
        workspaceId,
        name: input.name,
        description: input.description ?? null,
        targetCents: input.targetCents,
        currency: input.currency,
        deadline: input.deadline ?? null,
        category: input.category ?? null,
        color: input.color,
        linkedAccountId: input.linkedAccountId ?? null,
      })
      .returning();
    return created!;
  });
}

export async function contributeToGoal(
  userId: string,
  goalId: string,
  input: { amountCents: number; kind: "contribution" | "withdrawal"; note?: string | null }
) {
  return withUserRls(userId, async (tx) => {
    const [goal] = await tx
      .select()
      .from(financeGoals)
      .where(and(eq(financeGoals.id, goalId), eq(financeGoals.userId, userId)))
      .limit(1);
    if (!goal) throw new FinanceServiceError(404, "NOT_FOUND", "Goal not found");

    const delta = input.kind === "contribution" ? input.amountCents : -input.amountCents;
    const nextReserved = Math.max(0, goal.reservedCents + delta);
    const nextStatus = nextReserved >= goal.targetCents ? "completed" : "active";

    await tx.insert(financeGoalContributions).values({
      userId,
      goalId: goal.id,
      amountCents: input.amountCents,
      kind: input.kind,
      note: input.note ?? null,
    });

    const [updated] = await tx
      .update(financeGoals)
      .set({
        reservedCents: nextReserved,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(financeGoals.id, goal.id))
      .returning();

    return updated!;
  });
}

export async function importCsvTransactions(
  userId: string,
  workspaceId: string,
  input: {
    accountId: string;
    filename: string;
    rows: Array<{
      date: string;
      description: string;
      amountCents: number;
      type: "income" | "expense";
    }>;
  }
) {
  return withUserRls(userId, async (tx) => {
    const [acc] = await tx
      .select({ id: financeAccounts.id, currency: financeAccounts.currency })
      .from(financeAccounts)
      .where(and(eq(financeAccounts.id, input.accountId), eq(financeAccounts.userId, userId)))
      .limit(1);
    if (!acc) throw new FinanceServiceError(404, "ACCOUNT_NOT_FOUND", "Account not found");

    const existing = await tx
      .select({
        date: financeTransactions.transactionDate,
        amountCents: financeTransactions.amountCents,
        description: financeTransactions.description,
      })
      .from(financeTransactions)
      .where(eq(financeTransactions.accountId, acc.id));

    const sigSet = new Set(
      existing.map((e) => `${e.date}|${e.amountCents}|${e.description.toLowerCase()}`)
    );

    let imported = 0;
    let skipped = 0;

    for (const row of input.rows) {
      const absCents = Math.abs(row.amountCents);
      if (absCents === 0) {
        skipped++;
        continue;
      }
      const sig = `${row.date}|${absCents}|${row.description.toLowerCase()}`;
      if (sigSet.has(sig)) {
        skipped++;
        continue;
      }
      sigSet.add(sig);

      await tx.insert(financeTransactions).values({
        userId,
        workspaceId,
        accountId: acc.id,
        type: row.type,
        status: "confirmed",
        amountCents: absCents,
        currency: acc.currency,
        description: row.description,
        transactionDate: row.date,
      });
      imported++;
    }

    const [batch] = await tx
      .insert(financeImportBatches)
      .values({
        userId,
        workspaceId,
        accountId: acc.id,
        filename: input.filename,
        totalRows: input.rows.length,
        importedRows: imported,
        skippedRows: skipped,
      })
      .returning();

    return { batch: batch!, imported, skipped };
  });
}

export { gte };
