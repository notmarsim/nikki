export type AnalyticsPeriod = "today" | "7d" | "30d" | "month" | "year";

export function computePeriodRange(
  period: AnalyticsPeriod,
  referenceDate = new Date()
): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  daysCount: number;
} {
  const end = new Date(referenceDate);
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(referenceDate);
  start.setUTCHours(0, 0, 0, 0);

  if (period === "7d") {
    start.setUTCDate(start.getUTCDate() - 6);
  } else if (period === "30d") {
    start.setUTCDate(start.getUTCDate() - 29);
  } else if (period === "month") {
    start.setUTCDate(1);
  } else if (period === "year") {
    start.setUTCMonth(0, 1);
  }

  const spanMs = end.getTime() - start.getTime() + 1;
  const daysCount = Math.max(1, Math.round(spanMs / (24 * 60 * 60 * 1000)));

  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - spanMs + 1);

  return { start, end, prevStart, prevEnd, daysCount };
}

export function computeDeltaPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
