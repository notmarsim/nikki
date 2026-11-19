"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Layers, Play, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface DeckSummary {
  id: string;
  title: string;
  description: string | null;
  totalCards: number;
  dueCount: number;
  newCount: number;
}

interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  fsrsState: number;
  reps: number;
  dueAt: string;
}

export function FlashcardsWorkspace({
  initialOverview,
}: {
  initialOverview: {
    decks: DeckSummary[];
    stats: {
      totalCards: number;
      totalDue: number;
      totalNew: number;
      reviewedToday: number;
      retentionRate: number | null;
    };
  };
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(
    searchParams.get("deckId") ?? initialOverview.decks[0]?.id ?? null
  );
  const [reviewMode, setReviewMode] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewRequestId, setReviewRequestId] = useState<string>(() => crypto.randomUUID());

  // Forms
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [noteType, setNoteType] = useState<"basic" | "basic_reversed" | "cloze">("basic");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const { data: overview = initialOverview } = useQuery({
    queryKey: ["flashcards-overview"],
    queryFn: async () => {
      const res = await fetch("/api/flashcards/decks");
      if (!res.ok) throw new Error("Failed to load decks");
      const json = await res.json();
      return json.data as typeof initialOverview;
    },
    initialData: initialOverview,
  });

  const { data: deckDetail } = useQuery<{
    deck: DeckSummary;
    allCards: FlashcardItem[];
    dueCards: FlashcardItem[];
  }>({
    queryKey: ["flashcard-deck", selectedDeckId],
    queryFn: async () => {
      const res = await fetch(`/api/flashcards/decks/${selectedDeckId}/due`);
      if (!res.ok) throw new Error("Failed to load deck cards");
      const json = await res.json();
      return json.data;
    },
    enabled: Boolean(selectedDeckId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["flashcards-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["flashcard-deck", selectedDeckId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const currentDueCard = deckDetail?.dueCards[0] ?? null;

  const submitReview = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentDueCard || submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/flashcards/cards/${currentDueCard.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, reviewRequestId }),
      });
      if (res.ok) {
        setRevealed(false);
        setReviewRequestId(crypto.randomUUID());
        await refresh();
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (!reviewMode || !currentDueCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed) {
        if (e.key === "1") void submitReview(1);
        else if (e.key === "2") void submitReview(2);
        else if (e.key === "3") void submitReview(3);
        else if (e.key === "4") void submitReview(4);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewMode, revealed, currentDueCard?.id, submittingReview]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flashcards</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Smart spaced repetition that schedules reviews right before you forget.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">Due Now</div>
            <div className="text-2xl font-bold">{overview.stats.totalDue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">New Cards</div>
            <div className="text-2xl font-bold">{overview.stats.totalNew}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">Reviewed Today</div>
            <div className="text-2xl font-bold">{overview.stats.reviewedToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-[var(--muted-foreground)]">Observed Retention</div>
            <div className="text-2xl font-bold">
              {overview.stats.retentionRate !== null
                ? `${overview.stats.retentionRate}%`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review Mode */}
      {reviewMode && deckDetail ? (
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)]">
            <div>
              <CardTitle className="text-base">{deckDetail.deck.title}</CardTitle>
              <p className="text-xs text-[var(--muted-foreground)]">
                {deckDetail.dueCards.length} cards remaining
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setReviewMode(false)}>
              Exit Review
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            {!currentDueCard ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-base font-semibold">Session complete!</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  All due cards in this deck have been reviewed.
                </p>
                <Button onClick={() => setReviewMode(false)}>Back to Deck</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="min-h-[140px] rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-6 flex flex-col items-center justify-center text-center">
                  <div className="text-lg font-medium whitespace-pre-wrap">
                    {currentDueCard.front}
                  </div>

                  {revealed && (
                    <div className="mt-5 w-full border-t border-[var(--border)] pt-5 text-base text-[var(--foreground)] whitespace-pre-wrap">
                      {currentDueCard.back}
                    </div>
                  )}
                </div>

                {!revealed ? (
                  <div className="flex justify-center">
                    <Button onClick={() => setRevealed(true)}>
                      <Eye className="h-4 w-4" /> Reveal Answer (Space)
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      variant="outline"
                      disabled={submittingReview}
                      onClick={() => submitReview(1)}
                      className="border-red-500/40 text-red-500"
                    >
                      1 · Again
                    </Button>
                    <Button
                      variant="outline"
                      disabled={submittingReview}
                      onClick={() => submitReview(2)}
                    >
                      2 · Hard
                    </Button>
                    <Button
                      variant="outline"
                      disabled={submittingReview}
                      onClick={() => submitReview(3)}
                      className="border-blue-500/40 text-blue-500"
                    >
                      3 · Good
                    </Button>
                    <Button
                      variant="outline"
                      disabled={submittingReview}
                      onClick={() => submitReview(4)}
                      className="border-emerald-500/40 text-emerald-500"
                    >
                      4 · Easy
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Decks List */}
          <div className="space-y-3 lg:col-span-4">
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newDeckTitle.trim()) return;
                const res = await fetch("/api/flashcards/decks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: newDeckTitle.trim() }),
                });
                if (res.ok) {
                  const json = await res.json();
                  setNewDeckTitle("");
                  setSelectedDeckId(json.data.deck.id);
                  await refresh();
                }
              }}
            >
              <Input
                placeholder="New deck name..."
                value={newDeckTitle}
                onChange={(e) => setNewDeckTitle(e.target.value)}
              />
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            {overview.decks.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-xs text-[var(--muted-foreground)]">
                  No decks yet. Create your first deck above!
                </CardContent>
              </Card>
            ) : (
              overview.decks.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDeckId(d.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedDeckId === d.id
                      ? "border-[var(--accent)] bg-[var(--surface)]"
                      : "border-[var(--border)] bg-[var(--surface)]/60 hover:bg-[var(--surface)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{d.title}</span>
                    <Badge variant={d.dueCount > 0 ? "accent" : "outline"}>
                      {d.dueCount} due
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {d.totalCards} cards · {d.newCount} new
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Deck Cards & Add Card */}
          <div className="lg:col-span-8">
            {!selectedDeckId || !deckDetail ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-[var(--muted-foreground)]">
                  <Layers className="mb-2 h-8 w-8 opacity-60" />
                  Select a deck to add or review flashcards.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--border)]">
                  <div>
                    <CardTitle className="text-lg">{deckDetail.deck.title}</CardTitle>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {deckDetail.dueCards.length} due for review
                    </p>
                  </div>
                  <Button
                    disabled={deckDetail.dueCards.length === 0}
                    onClick={() => {
                      setRevealed(false);
                      setReviewRequestId(crypto.randomUUID());
                      setReviewMode(true);
                    }}
                  >
                    <Play className="h-4 w-4" /> Start Review
                  </Button>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  <form
                    className="space-y-3 rounded-xl border border-[var(--border)] p-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!front.trim()) return;
                      const res = await fetch("/api/flashcards/cards", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          deckId: selectedDeckId,
                          noteType,
                          front: front.trim(),
                          back: back.trim(),
                          clozeText: noteType === "cloze" ? front.trim() : null,
                        }),
                      });
                      if (res.ok) {
                        setFront("");
                        setBack("");
                        await refresh();
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">Add Card:</span>
                      {(["basic", "basic_reversed", "cloze"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNoteType(t)}
                          className={`rounded px-2 py-0.5 text-xs ${
                            noteType === t
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]"
                          }`}
                        >
                          {t.replace("_", " ")}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={2}
                      required
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      placeholder={
                        noteType === "cloze"
                          ? "Use {{c1::answer}} syntax for cloze deletions..."
                          : "Front (question)..."
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    />

                    {noteType !== "cloze" && (
                      <textarea
                        rows={2}
                        required
                        value={back}
                        onChange={(e) => setBack(e.target.value)}
                        placeholder="Back (answer)..."
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    )}

                    <div className="flex justify-end">
                      <Button type="submit" size="sm">
                        <Plus className="h-4 w-4" /> Add Card
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-2">
                    {deckDetail.allCards.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] p-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="font-medium">{c.front}</div>
                          <div className="text-[var(--muted-foreground)]">{c.back}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">
                            Due {new Date(c.dueAt).toLocaleDateString()}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              await fetch(`/api/flashcards/cards/${c.id}`, {
                                method: "DELETE",
                              });
                              await refresh();
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
