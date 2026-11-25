import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api-response";
import { getCurrentSession } from "@/modules/auth/session";
import {
  addQuizQuestion,
  createQuizWithQuestion,
  deleteQuiz,
  listQuizzesOverview,
  submitQuizAttempt,
} from "@/modules/learning/integration-service";
import { LearningServiceError } from "@/modules/learning/service";
import { getOrCreateDefaultWorkspace } from "@/modules/users/service";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_quiz"),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
    courseId: z.string().uuid().nullable().optional(),
    lessonId: z.string().uuid().nullable().optional(),
    noteId: z.string().uuid().nullable().optional(),
    passingScore: z.number().int().min(1).max(100).optional(),
    shuffleQuestions: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("add_question"),
    quizId: z.string().uuid(),
    questionType: z.enum([
      "multiple_choice",
      "multiple_answers",
      "true_false",
      "short_answer",
      "self_assessed",
    ]),
    prompt: z.string().trim().min(1).max(1000),
    options: z.array(z.string().trim().min(1)).optional(),
    correctAnswers: z.array(z.string()).optional(),
    referenceAnswer: z.string().max(2000).nullable().optional(),
    explanation: z.string().max(2000).nullable().optional(),
    points: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    action: z.literal("submit_attempt"),
    quizId: z.string().uuid(),
    answers: z.array(
      z.object({
        questionId: z.string().uuid(),
        selected: z.array(z.string()).default([]),
        textAnswer: z.string().optional(),
        selfCorrect: z.boolean().optional(),
      })
    ),
  }),
]);

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const { searchParams } = new URL(request.url);
  const workspace = await getOrCreateDefaultWorkspace(session.user.id);
  const quizzes = await listQuizzesOverview(session.user.id, workspace.id, {
    courseId: searchParams.get("courseId") ?? undefined,
    lessonId: searchParams.get("lessonId") ?? undefined,
    noteId: searchParams.get("noteId") ?? undefined,
  });
  return apiOk({ quizzes });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const body: unknown = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid quiz payload");
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(session.user.id);
    if (parsed.data.action === "create_quiz") {
      const quiz = await createQuizWithQuestion(session.user.id, workspace.id, parsed.data);
      return apiOk({ quiz }, 201);
    }
    if (parsed.data.action === "add_question") {
      const question = await addQuizQuestion(session.user.id, parsed.data);
      return apiOk({ question }, 201);
    }
    const attempt = await submitQuizAttempt(
      session.user.id,
      parsed.data.quizId,
      parsed.data.answers
    );
    return apiOk({ attempt }, 201);
  } catch (err) {
    if (err instanceof LearningServiceError) {
      return apiError(err.status, err.code, err.message);
    }
    return apiError(500, "INTERNAL_ERROR", "Failed to process quiz");
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return apiError(401, "UNAUTHORIZED", "Authentication required");

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return apiError(400, "VALIDATION_ERROR", "id is required");

  return apiOk(await deleteQuiz(session.user.id, id));
}
