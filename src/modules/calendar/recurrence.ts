import { RRule, rrulestr, type Weekday } from "rrule";

const WEEKDAY_MAP: Weekday[] = [
  RRule.SU,
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
];

export interface RecurrenceRuleInput {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
  byWeekdays?: number[];
  until?: string | null;
  count?: number | null;
}

export function buildRRuleString(
  dtstart: Date,
  input: RecurrenceRuleInput
): string {
  const freq =
    input.frequency === "daily"
      ? RRule.DAILY
      : input.frequency === "weekly"
        ? RRule.WEEKLY
        : RRule.MONTHLY;

  const byweekday =
    input.byWeekdays && input.byWeekdays.length > 0
      ? input.byWeekdays.map((d) => WEEKDAY_MAP[d]!).filter(Boolean)
      : undefined;

  const rule = new RRule({
    freq,
    interval: input.interval ?? 1,
    dtstart,
    ...(byweekday ? { byweekday } : {}),
    ...(input.until ? { until: new Date(input.until) } : {}),
    ...(input.count ? { count: input.count } : {}),
  });

  return rule.toString();
}

export interface ExpandableEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  isAllDay: boolean;
  allDayDate: string | null;
  location: string | null;
  color: string;
  category: string;
  status: string;
  recurrenceRule: string | null;
}

export interface EventExceptionRecord {
  eventId: string;
  originalOccurrence: Date;
  replacementStart: Date | null;
  replacementEnd: Date | null;
  replacementTitle: string | null;
  isCanceled: boolean;
}

export interface CalendarOccurrence {
  occurrenceId: string;
  eventId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  originalOccurrence: Date;
  timezone: string;
  isAllDay: boolean;
  allDayDate: string | null;
  location: string | null;
  color: string;
  category: string;
  isRecurring: boolean;
  hasConflict?: boolean;
}

export function expandEventOccurrences(
  event: ExpandableEvent,
  exceptions: EventExceptionRecord[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarOccurrence[] {
  const durationMs = Math.max(
    15 * 60 * 1000,
    event.endsAt.getTime() - event.startsAt.getTime()
  );

  if (!event.recurrenceRule) {
    if (event.endsAt < rangeStart || event.startsAt > rangeEnd) {
      return [];
    }
    return [
      {
        occurrenceId: event.id,
        eventId: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        originalOccurrence: event.startsAt,
        timezone: event.timezone,
        isAllDay: event.isAllDay,
        allDayDate: event.allDayDate,
        location: event.location,
        color: event.color,
        category: event.category,
        isRecurring: false,
      },
    ];
  }

  const rule = rrulestr(event.recurrenceRule, { dtstart: event.startsAt });
  // Expand slightly before rangeStart to catch occurrences spanning into rangeStart (e.g. crossing midnight)
  const searchStart = new Date(rangeStart.getTime() - durationMs);
  const dates = rule.between(searchStart, rangeEnd, true).slice(0, 200);

  const exceptionByTs = new Map<number, EventExceptionRecord>();
  for (const ex of exceptions) {
    if (ex.eventId === event.id) {
      exceptionByTs.set(ex.originalOccurrence.getTime(), ex);
    }
  }

  const occurrences: CalendarOccurrence[] = [];
  for (const occDate of dates) {
    const ex = exceptionByTs.get(occDate.getTime());
    if (ex?.isCanceled) continue;

    const startsAt = ex?.replacementStart ?? occDate;
    const endsAt = ex?.replacementEnd ?? new Date(startsAt.getTime() + durationMs);

    if (endsAt < rangeStart || startsAt > rangeEnd) continue;

    occurrences.push({
      occurrenceId: `${event.id}:${occDate.toISOString()}`,
      eventId: event.id,
      title: ex?.replacementTitle ?? event.title,
      description: event.description,
      startsAt,
      endsAt,
      originalOccurrence: occDate,
      timezone: event.timezone,
      isAllDay: event.isAllDay,
      allDayDate: event.allDayDate,
      location: event.location,
      color: event.color,
      category: event.category,
      isRecurring: true,
    });
  }

  return occurrences;
}

export function markOccurrenceConflicts<
  T extends { occurrenceId: string; startsAt: Date; endsAt: Date; isAllDay: boolean },
>(occurrences: T[]): Array<T & { hasConflict: boolean }> {
  const timed = occurrences
    .filter((o) => !o.isAllDay)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const conflictedIds = new Set<string>();
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i]!;
    for (let j = i + 1; j < timed.length; j += 1) {
      const b = timed[j]!;
      if (b.startsAt.getTime() >= a.endsAt.getTime()) break;
      conflictedIds.add(a.occurrenceId);
      conflictedIds.add(b.occurrenceId);
    }
  }

  return occurrences.map((occ) => ({
    ...occ,
    hasConflict: conflictedIds.has(occ.occurrenceId),
  }));
}
