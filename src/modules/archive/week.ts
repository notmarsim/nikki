export type WeekStartDay = "sunday" | "monday" | "saturday";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const START_DAY_INDEX: Record<WeekStartDay, number> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
};

function safeTimeZone(tz: string | null | undefined): string {
  const candidate = tz?.trim() || "UTC";
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "UTC";
  }
}

function getLocalParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: WEEKDAY_INDEX[map.weekday ?? "Mon"] ?? 1,
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Converts a wall-clock local date/time in `timeZone` to an exact UTC Date,
 * using a two-pass offset adjustment so DST transitions resolve accurately.
 */
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const pass1 = getLocalParts(new Date(utcGuess), timeZone);
  const pass1AsUtc = Date.UTC(
    pass1.year,
    pass1.month - 1,
    pass1.day,
    pass1.hour,
    pass1.minute,
    pass1.second,
    ms
  );
  const offset1 = pass1AsUtc - utcGuess;
  const corrected1 = utcGuess - offset1;

  const pass2 = getLocalParts(new Date(corrected1), timeZone);
  const pass2AsUtc = Date.UTC(
    pass2.year,
    pass2.month - 1,
    pass2.day,
    pass2.hour,
    pass2.minute,
    pass2.second,
    ms
  );
  const offset2 = pass2AsUtc - corrected1;
  return new Date(utcGuess - offset2);
}

/**
 * Computes the UTC instant corresponding to 23:59:59.999 of the last day of the
 * week containing `referenceDate`, respecting `timeZone` and `weekStartsOn`.
 */
export function computeWeekEndUtc(
  referenceDate: Date,
  timeZone: string | null | undefined,
  weekStartsOn: WeekStartDay = "monday"
): Date {
  const tz = safeTimeZone(timeZone);
  const local = getLocalParts(referenceDate, tz);
  const startIdx = START_DAY_INDEX[weekStartsOn] ?? 1;
  const endIdx = (startIdx + 6) % 7;
  const daysUntilEnd = (endIdx - local.weekday + 7) % 7;

  const endCalendar = new Date(Date.UTC(local.year, local.month - 1, local.day + daysUntilEnd));
  return zonedWallClockToUtc(
    endCalendar.getUTCFullYear(),
    endCalendar.getUTCMonth() + 1,
    endCalendar.getUTCDate(),
    23,
    59,
    59,
    999,
    tz
  );
}

export function isEligibleForWeeklyArchive(
  task: {
    status: string;
    archivedAt: Date | null;
    deletedAt: Date | null;
    archiveAfter: Date | null;
  },
  now: Date = new Date(),
  autoArchiveEnabled = true
): boolean {
  if (!autoArchiveEnabled) return false;
  if (task.status !== "done") return false;
  if (task.archivedAt !== null || task.deletedAt !== null) return false;
  if (!task.archiveAfter) return false;
  return task.archiveAfter.getTime() <= now.getTime();
}
