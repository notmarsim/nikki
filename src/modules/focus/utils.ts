export interface FocusIntervalLike {
  intervalType: string;
  startedAt: Date;
  endedAt: Date | null;
}

export function computeElapsedFocusSeconds(
  intervals: FocusIntervalLike[],
  now: Date = new Date()
): number {
  let totalMs = 0;

  for (const interval of intervals) {
    if (interval.intervalType !== "focus") continue;
    const start = interval.startedAt.getTime();
    const end = (interval.endedAt ?? now).getTime();
    if (end > start) {
      totalMs += end - start;
    }
  }

  return Math.floor(totalMs / 1000);
}
