export type SearchEntityType =
  | "note"
  | "task"
  | "project"
  | "course"
  | "lesson"
  | "event"
  | "deck"
  | "habit"
  | "bookmark"
  | "snippet"
  | "command"
  | "reference";

export const ALL_SEARCH_TYPES: SearchEntityType[] = [
  "note",
  "task",
  "project",
  "course",
  "lesson",
  "event",
  "deck",
  "habit",
  "bookmark",
  "snippet",
  "command",
  "reference",
];

export interface GlobalSearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  snippet: string;
  context?: string;
  href: string;
  rank: number;
  updatedAt: string;
}
