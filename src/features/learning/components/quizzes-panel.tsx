"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Play, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface QuizQuestionItem {
  id: string;
  questionType: string;
  prompt: string;
  options: string[];
  correctAnswers: string[];
  referenceAnswer: string | null;
  explanation: string | null;
  points: number;
}

interface QuizItem {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  questions: QuizQuestionItem[];
  attempts: Array<{ id: string; scorePercent: number; passed: boolean; completedAt: string }>;
}

export function QuizzesPanel({ courseId }: { courseId?: string | null }) {
  const { tr } = useI18n();
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [title, setTitle] = useState("");
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  // Add question form
  const [qType, setQType] = useState("multiple_choice");
  const [qPrompt, setQPrompt] = useState("");
  const [qOptions, setQOptions] = useState("");
  const [qCorrect, setQCorrect] = useState("");
  const [qRef, setQRef] = useState("");
  const [qExpl, setQExpl] = useState("");

  // Taking quiz
  const [takingQuiz, setTakingQuiz] = useState<QuizItem | null>(null);
  const [answers, setAnswers] = useState<
    Record<string, { selected: string[]; textAnswer?: string; selfCorrect?: boolean }>
  >({});
  const [lastAttempt, setLastAttempt] = useState<{ scorePercent: number; passed: boolean } | null>(null);

  const load = async () => {
    const qs = courseId ? `?courseId=${courseId}` : "";
    const res = await fetch(`/api/learning/quizzes${qs}`);
    if (res.ok) {
      const json = await res.json();
      setQuizzes(json.data?.quizzes ?? []);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tr("Create Manual Quiz", "Criar Quiz Manual")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!title.trim()) return;
              const res = await fetch("/api/learning/quizzes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create_quiz",
                  title: title.trim(),
                  courseId: courseId ?? null,
                }),
              });
              if (res.ok) {
                const json = await res.json();
                setTitle("");
                setActiveQuizId(json.data.quiz.id);
                await load();
              }
            }}
            className="flex gap-2"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tr("Quiz title (e.g. Linux Permissions Check)...", "Título do quiz...")}
              required
            />
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" /> {tr("Create", "Criar")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {takingQuiz && (
        <Card className="border-[var(--accent)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {tr("Quiz:", "Quiz:")} {takingQuiz.title}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setTakingQuiz(null)}>
              {tr("Close", "Fechar")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {lastAttempt && (
              <div
                className={`rounded-lg border p-3 font-medium ${
                  lastAttempt.passed
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                }`}
              >
                {tr("Score:", "Pontuação:")} {lastAttempt.scorePercent}% ·{" "}
                {lastAttempt.passed ? tr("Passed!", "Aprovado!") : tr("Keep practicing", "Continue praticando")}
              </div>
            )}

            {takingQuiz.questions.map((q, idx) => {
              const ans = answers[q.id] ?? { selected: [] };
              return (
                <div key={q.id} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                  <div className="font-medium">
                    {idx + 1}. {q.prompt}
                  </div>
                  {(q.questionType === "multiple_choice" ||
                    q.questionType === "multiple_answers" ||
                    q.questionType === "true_false") && (
                    <div className="space-y-1">
                      {(q.questionType === "true_false" ? ["True", "False"] : q.options).map((opt) => {
                        const checked = ans.selected.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type={q.questionType === "multiple_answers" ? "checkbox" : "radio"}
                              name={`q-${q.id}`}
                              checked={checked}
                              onChange={() => {
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: {
                                    ...ans,
                                    selected:
                                      q.questionType === "multiple_answers"
                                        ? checked
                                          ? ans.selected.filter((s) => s !== opt)
                                          : [...ans.selected, opt]
                                        : [opt],
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {(q.questionType === "short_answer" || q.questionType === "self_assessed") && (
                    <div className="space-y-2">
                      <Input
                        value={ans.textAnswer ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { ...ans, textAnswer: e.target.value },
                          }))
                        }
                        placeholder={tr("Your answer...", "Sua resposta...")}
                      />
                      {q.questionType === "self_assessed" && q.referenceAnswer && (
                        <div className="space-y-1 rounded bg-[var(--surface-muted)] p-2">
                          <div className="text-[11px] text-[var(--muted-foreground)]">
                            {tr("Reference:", "Referência:")} {q.referenceAnswer}
                          </div>
                          <label className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={Boolean(ans.selfCorrect)}
                              onChange={(e) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: { ...ans, selfCorrect: e.target.checked },
                                }))
                              }
                            />
                            {tr("I answered this correctly", "Acertei esta questão")}
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                  {lastAttempt && q.explanation && (
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      {tr("Explanation:", "Explicação:")} {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}

            <Button
              size="sm"
              onClick={async () => {
                const payloadAnswers = takingQuiz.questions.map((q) => ({
                  questionId: q.id,
                  selected: answers[q.id]?.selected ?? [],
                  textAnswer: answers[q.id]?.textAnswer,
                  selfCorrect: answers[q.id]?.selfCorrect,
                }));
                const res = await fetch("/api/learning/quizzes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "submit_attempt",
                    quizId: takingQuiz.id,
                    answers: payloadAnswers,
                  }),
                });
                if (res.ok) {
                  const json = await res.json();
                  setLastAttempt(json.data.attempt);
                  await load();
                }
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {tr("Submit Answers", "Enviar Respostas")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {quizzes.map((q) => (
          <Card key={q.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">{q.title}</CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={q.questions.length === 0}
                  onClick={() => {
                    setTakingQuiz(q);
                    setAnswers({});
                    setLastAttempt(null);
                  }}
                >
                  <Play className="h-3.5 w-3.5" /> {tr("Take", "Responder")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveQuizId(activeQuizId === q.id ? null : q.id)}
                >
                  + {tr("Question", "Questão")}
                </Button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/learning/quizzes?id=${q.id}`, { method: "DELETE" });
                    await load();
                  }}
                  className="rounded p-1 text-red-500 hover:bg-[var(--surface-muted)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                <Badge variant="outline">
                  {q.questions.length} {tr("questions", "questões")}
                </Badge>
                {q.attempts[0] && (
                  <Badge variant="outline">
                    {tr("Last:", "Último:")} {q.attempts[0].scorePercent}%
                  </Badge>
                )}
              </div>

              {activeQuiz?.id === q.id && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!qPrompt.trim()) return;
                    const opts = qOptions
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const corr = qCorrect
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const res = await fetch("/api/learning/quizzes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "add_question",
                        quizId: q.id,
                        questionType: qType,
                        prompt: qPrompt.trim(),
                        options: opts,
                        correctAnswers: corr,
                        referenceAnswer: qRef.trim() || null,
                        explanation: qExpl.trim() || null,
                      }),
                    });
                    if (res.ok) {
                      setQPrompt("");
                      setQOptions("");
                      setQCorrect("");
                      setQRef("");
                      setQExpl("");
                      await load();
                    }
                  }}
                  className="space-y-2 border-t border-[var(--border)] pt-2"
                >
                  <select
                    value={qType}
                    onChange={(e) => setQType(e.target.value)}
                    className="h-8 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 text-xs"
                  >
                    <option value="multiple_choice">{tr("Multiple Choice", "Múltipla Escolha")}</option>
                    <option value="multiple_answers">{tr("Multiple Answers", "Múltiplas Respostas")}</option>
                    <option value="true_false">{tr("True or False", "Verdadeiro ou Falso")}</option>
                    <option value="short_answer">{tr("Short Answer", "Resposta Curta")}</option>
                    <option value="self_assessed">{tr("Self-assessed", "Autoavaliada")}</option>
                  </select>
                  <Input
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    placeholder={tr("Question prompt...", "Enunciado da questão...")}
                    required
                  />
                  {(qType === "multiple_choice" || qType === "multiple_answers") && (
                    <Input
                      value={qOptions}
                      onChange={(e) => setQOptions(e.target.value)}
                      placeholder={tr("Options (comma-separated)", "Opções (separadas por vírgula)")}
                    />
                  )}
                  {(qType === "multiple_choice" || qType === "multiple_answers" || qType === "true_false") && (
                    <Input
                      value={qCorrect}
                      onChange={(e) => setQCorrect(e.target.value)}
                      placeholder={tr("Correct answer(s) (comma-separated)", "Resposta(s) correta(s)")}
                    />
                  )}
                  {(qType === "short_answer" || qType === "self_assessed") && (
                    <Input
                      value={qRef}
                      onChange={(e) => setQRef(e.target.value)}
                      placeholder={tr("Reference answer", "Resposta de referência")}
                    />
                  )}
                  <Input
                    value={qExpl}
                    onChange={(e) => setQExpl(e.target.value)}
                    placeholder={tr("Explanation (optional)", "Explicação (opcional)")}
                  />
                  <Button type="submit" size="sm">
                    {tr("Add Question", "Adicionar Questão")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
