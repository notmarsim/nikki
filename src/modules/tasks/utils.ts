export function calculateNextOccurrence(
  baseDate: Date,
  frequency: "daily" | "weekly" | "monthly",
  interval: number
): Date {
  const next = new Date(baseDate.getTime());
  if (frequency === "daily") {
    next.setUTCDate(next.getUTCDate() + interval);
  } else if (frequency === "weekly") {
    next.setUTCDate(next.getUTCDate() + interval * 7);
  } else {
    next.setUTCMonth(next.getUTCMonth() + interval);
  }
  return next;
}

export function wouldCreateTaskCycle(
  allTasks: Array<{ id: string; parentTaskId: string | null }>,
  taskId: string,
  targetParentId: string | null
): boolean {
  if (!targetParentId) return false;
  if (targetParentId === taskId) return true;

  const parentMap = new Map<string, string | null>();
  for (const t of allTasks) {
    parentMap.set(t.id, t.parentTaskId);
  }

  const visited = new Set<string>([taskId]);
  let cursor: string | null = targetParentId;

  while (cursor) {
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parentMap.get(cursor) ?? null;
  }

  return false;
}
