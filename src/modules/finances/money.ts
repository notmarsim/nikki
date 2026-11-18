export function parseMoneyToCents(raw: string | number): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new Error("Invalid numeric amount");
    return Math.round(raw * 100);
  }
  const trimmed = raw.trim().replace(/[R$\s\u00A0]/g, "");
  if (!trimmed) throw new Error("Empty amount");

  // Detect Brazilian format (e.g. 1.234,56) vs US format (1,234.56)
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized = trimmed;

  if (hasComma && hasDot) {
    if (trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = trimmed.replace(",", ".");
  }

  const num = Number(normalized);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid monetary value: ${raw}`);
  }
  return Math.round(num * 100);
}

export function formatCents(
  cents: number,
  currency = "BRL",
  showCents = true,
  hidden = false
): string {
  if (hidden) return "••••";
  const value = cents / 100;
  try {
    return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(showCents ? 2 : 0)}`;
  }
}

export function splitInstallmentsCents(totalCents: number, count: number): number[] {
  if (count <= 1) return [totalCents];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, idx) => (idx < remainder ? base + 1 : base));
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function clampDay(year: number, month1Based: number, day: number): string {
  const maxDay = daysInMonth(year, month1Based);
  const safeDay = Math.min(Math.max(1, day), maxDay);
  const m = String(month1Based).padStart(2, "0");
  const d = String(safeDay).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function computeStatementPeriod(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
  installmentOffset = 0
): { periodKey: string; closingDate: string; dueDate: string } {
  const [yStr, mStr, dStr] = purchaseDate.split("-");
  let year = Number(yStr);
  let month = Number(mStr); // 1-12
  const day = Number(dStr);

  // Purchases on or after closingDay roll into next month's statement
  if (day >= closingDay) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  // Add installment offset months
  const totalMonths = year * 12 + (month - 1) + installmentOffset;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  const periodKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const closingDate = clampDay(targetYear, targetMonth, closingDay);

  // If dueDay < closingDay, due date is in the following month
  let dueYear = targetYear;
  let dueMonth = targetMonth;
  if (dueDay < closingDay) {
    dueMonth += 1;
    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear += 1;
    }
  }
  const dueDate = clampDay(dueYear, dueMonth, dueDay);

  return { periodKey, closingDate, dueDate };
}

export function sanitizeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
