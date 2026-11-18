export function computeLearningProgress(
  lessons: Array<{ id: string; status: string }>
): { total: number; completed: number; progress: number } {
  const seen = new Set<string>();
  let total = 0;
  let completed = 0;

  for (const lesson of lessons) {
    if (seen.has(lesson.id)) continue;
    seen.add(lesson.id);
    total += 1;
    if (lesson.status === "completed") {
      completed += 1;
    }
  }

  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, progress };
}
