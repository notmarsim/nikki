import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().trim().min(1).max(100),
  accountType: z
    .enum(["cash", "checking", "savings", "wallet", "investment", "other"])
    .default("checking"),
  institution: z.string().trim().max(100).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#10b981"),
  icon: z.string().trim().max(40).default("Wallet"),
  currency: z.string().trim().length(3).default("BRL"),
  initialBalanceCents: z.number().int().default(0),
  balanceReferenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  institution: z.string().trim().max(100).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["income", "expense"]).default("expense"),
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  icon: z.string().trim().max(40).default("Tag"),
});

export const createTransactionSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  type: z.enum(["income", "expense", "adjustment", "refund"]).default("expense"),
  status: z.enum(["pending", "confirmed", "canceled"]).default("confirmed"),
  amountCents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("BRL"),
  description: z.string().trim().min(1).max(240),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().max(40)).max(15).optional(),
  splits: z
    .array(
      z.object({
        categoryId: z.string().uuid().nullable().optional(),
        amountCents: z.number().int().positive(),
        description: z.string().trim().max(120).nullable().optional(),
      })
    )
    .optional(),
});

export const createTransferSchema = z.object({
  sourceAccountId: z.string().uuid(),
  targetAccountId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  feeCents: z.number().int().min(0).default(0),
  description: z.string().trim().min(1).max(240).default("Account transfer"),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createCreditCardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  institution: z.string().trim().max(100).default(""),
  last4: z.string().regex(/^\d{4}$/).nullable().optional(),
  brand: z.string().trim().max(40).nullable().optional(),
  creditLimitCents: z.number().int().min(0),
  currency: z.string().trim().length(3).default("BRL"),
  closingDay: z.number().int().min(1).max(31).default(10),
  dueDay: z.number().int().min(1).max(31).default(17),
  paymentAccountId: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8b5cf6"),
});

export const createCardPurchaseSchema = z.object({
  cardId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(240),
  totalCents: z.number().int().positive(),
  installmentsCount: z.number().int().min(1).max(48).default(1),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const payStatementSchema = z.object({
  statementId: z.string().uuid(),
  accountId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createBudgetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  categoryId: z.string().uuid().nullable().optional(),
  period: z.enum(["weekly", "monthly", "annual", "custom"]).default("monthly"),
  limitCents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("BRL"),
  rolloverEnabled: z.boolean().default(false),
  alertThresholds: z.array(z.number().int().min(1).max(200)).default([50, 75, 90, 100]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const createRecurringRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["income", "expense"]).default("expense"),
  amountCents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("BRL"),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "annual", "custom"]).default("monthly"),
  intervalValue: z.number().int().min(1).max(365).default(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  autoConfirm: z.boolean().default(false),
});

export const createGoalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  targetCents: z.number().int().positive(),
  currency: z.string().trim().length(3).default("BRL"),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  linkedAccountId: z.string().uuid().nullable().optional(),
});

export const goalContributionSchema = z.object({
  amountCents: z.number().int().positive(),
  kind: z.enum(["contribution", "withdrawal"]).default("contribution"),
  note: z.string().trim().max(300).nullable().optional(),
});

export const importCsvSchema = z.object({
  accountId: z.string().uuid(),
  filename: z.string().trim().min(1).max(200).default("import.csv"),
  rows: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: z.string().trim().min(1).max(240),
        amountCents: z.number().int(),
        type: z.enum(["income", "expense"]),
      })
    )
    .min(1)
    .max(500),
});
