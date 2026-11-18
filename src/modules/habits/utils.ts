import type { HabitScheduleConfig } from "@/db/schema";

export interface HabitStreakInput {
  frequency: string;
  scheduleConfig: HabitScheduleConfig;
  targetValue: number;
  startDate: string; // YYYY-MM-DD
}

export function isDateScheduledForHabit(
  dateStr: string,
  frequency: string,
  scheduleConfig: HabitScheduleConfig
): boolean {
  if (frequency !== "specific_days") return true;
  const days = scheduleConfig.daysOfWeek ?? [];
  if (days.length === 0) return true;
  const date = new Date(`${dateStr}T12:00:00Z`);
  return days.includes(date.getUTCDay());
}

export function computeHabitStreaks(
  habit: HabitStreakInput,
  totalsByDate: Map<string, number>,
  todayStr: string
): { currentStreak: number; bestStreak: number; consistencyRate: number } {
  const start = new Date(`${habit.startDate}T12:00:00Z`);
  const today = new Date(`${todayStr}T12:00:00Z`);
  if (today < start) {
    return { currentStreak: 0, bestStreak: 0, consistencyRate: 0 };
  }

  if (habit.frequency === "weekly_count") {
    const targetPerWeek = Math.max(1, habit.scheduleConfig.targetPerPeriod ?? 3);
    const weekMap = new Map<string, number>();
    const cursor = new Date(start);
    while (cursor <= today) {
      const ds = cursor.toISOString().slice(0, 10);
      const dayOfWeek = (cursor.getUTCDay() + 6) % 7; // Monday = 0
      const weekStart = new Date(cursor);
      weekStart.setUTCDate(cursor.getUTCDate() - dayOfWeek);
      const wk = weekStart.toISOString().slice(0, 10);
      const val = totalsByDate.get(ds) ?? 0;
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + (val >= habit.targetValue ? 1 : 0));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const weeks = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let best = 0;
    let running = 0;
    let metCount = 0;
    for (const [, count] of weeks) {
      if (count >= targetPerWeek) {
        running += 1;
        metCount += 1;
        if (running > best) best = running;
      } else {
        running = 0;
      }
    }
    const current =
      weeks.length > 0 && (weeks[weeks.length - 1]?.[1] ?? 0) >= targetPerWeek
        ? running
        : weeks.length > 1 && running === 0
          ? 0
          : running;
    const consistencyRate =
      weeks.length > 0 ? Math.round((metCount / weeks.length) * 100) : 0;
    return { currentStreak: current, bestStreak: best, consistencyRate };
  }

  // Daily or Specific Days
  let best = 0;
  let running = 0;
  let scheduledDays = 0;
  let metDays = 0;

  const cursor = new Date(start);
  while (cursor <= today) {
    const ds = cursor.toISOString().slice(0, 10);
    if (isDateScheduledForHabit(ds, habit.frequency, habit.scheduleConfig)) {
      scheduledDays += 1;
      const val = totalsByDate.get(ds) ?? 0;
      if (val >= habit.targetValue) {
        running += 1;
        metDays += 1;
        if (running > best) best = running;
      } else if (ds !== todayStr) {
        // Do not break streak on today if today is still in progress
        running = 0;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const consistencyRate =
    scheduledDays > 0 ? Math.round((metDays / scheduledDays) * 100) : 0;

  return { currentStreak: running, bestStreak: best, consistencyRate };
}
