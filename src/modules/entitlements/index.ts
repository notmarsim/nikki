export type PlanTier = "free" | "premium";

export interface LearningEntitlements {
  tier: PlanTier;
  maxCourses: number | null;
  maxFlashcards: number | null;
  advancedAnalytics: boolean;
  advancedKnowledgeGraph: boolean;
  studyModeCustomization: boolean;
}

const DEFAULT_ENTITLEMENTS: LearningEntitlements = {
  tier: "free",
  maxCourses: null, // No arbitrary restrictions at this stage
  maxFlashcards: null,
  advancedAnalytics: true,
  advancedKnowledgeGraph: true,
  studyModeCustomization: true,
};

/**
 * Centralized entitlements resolver for future Free/Premium monetization.
 * All backend and frontend permission checks should read from this helper.
 */
export async function getUserEntitlements(_userId: string): Promise<LearningEntitlements> {
  return { ...DEFAULT_ENTITLEMENTS };
}

export function canCreateWithinLimit(
  currentCount: number,
  maxLimit: number | null
): boolean {
  if (maxLimit === null) return true;
  return currentCount < maxLimit;
}
