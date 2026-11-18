import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

export const FSRS_ALGORITHM_VERSION = "ts-fsrs-4";

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: false,
    enable_short_term: true,
  })
);

export interface StoredFsrsCard {
  fsrsState: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  dueAt: Date;
  lastReviewAt: Date | null;
}

export function ratingNumberToGrade(rating: 1 | 2 | 3 | 4): Grade {
  if (rating === 1) return Rating.Again;
  if (rating === 2) return Rating.Hard;
  if (rating === 3) return Rating.Good;
  return Rating.Easy;
}

export function scheduleNextFsrs(
  stored: StoredFsrsCard,
  rating: 1 | 2 | 3 | 4,
  now: Date = new Date()
) {
  const baseCard: Card = stored.reps === 0 && !stored.lastReviewAt
    ? createEmptyCard(now)
    : {
        due: stored.dueAt,
        stability: stored.stability,
        difficulty: stored.difficulty,
        elapsed_days: stored.elapsedDays,
        scheduled_days: stored.scheduledDays,
        reps: stored.reps,
        lapses: stored.lapses,
        state: stored.fsrsState as State,
        last_review: stored.lastReviewAt ?? undefined,
      };

  const grade = ratingNumberToGrade(rating);
  const scheduling = scheduler.repeat(baseCard, now);
  const record = scheduling[grade];

  return {
    previousState: stored.fsrsState,
    nextCard: record.card,
    log: record.log,
  };
}

export interface ClozeRenderedCard {
  templateKey: string;
  front: string;
  back: string;
}

export function parseClozeCards(clozeText: string): ClozeRenderedCard[] {
  const regex = /\{\{c(\d+)::([^}]+)\}\}/g;
  const indices = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clozeText)) !== null) {
    if (match[1]) indices.add(match[1]);
  }

  if (indices.size === 0) {
    return [
      {
        templateKey: "cloze_1",
        front: clozeText,
        back: clozeText,
      },
    ];
  }

  return Array.from(indices)
    .sort((a, b) => Number(a) - Number(b))
    .map((targetIdx) => {
      const front = clozeText.replace(
        /\{\{c(\d+)::([^}]+)\}\}/g,
        (_full, idx: string, answer: string) =>
          idx === targetIdx ? "[...]" : answer
      );
      const back = clozeText.replace(
        /\{\{c(\d+)::([^}]+)\}\}/g,
        (_full, _idx: string, answer: string) => answer
      );
      return {
        templateKey: `cloze_${targetIdx}`,
        front,
        back,
      };
    });
}
