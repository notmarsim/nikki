"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, Sparkles, X } from "lucide-react";
import { ALL_TOURS, INITIAL_TOUR_ID, type TourStepConfig } from "@/modules/onboarding/tours";
import { useUiStore } from "@/stores/ui-store";

interface OnboardingStatePayload {
  welcomeCompleted: boolean;
  tourStatus: "not_started" | "in_progress" | "completed" | "skipped";
  currentTourId: string | null;
  currentStepIndex: number;
  completedTours: string[];
  dismissedTours: string[];
}

export function OnboardingTourOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const interfaceMode = useUiStore((s) => s.interfaceMode);
  const setInterfaceMode = useUiStore((s) => s.setInterfaceMode);

  const [state, setState] = useState<OnboardingStatePayload | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [selectedMode, setSelectedMode] = useState<"simple" | "advanced">(interfaceMode);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (!res.ok) return;
      const json = (await res.json()) as { data?: { state: OnboardingStatePayload } };
      if (json.data?.state) setState(json.data.state);
    } catch {
      // Ignore offline errors
    }
  }, []);

  useEffect(() => {
    void loadState();
    const onRestart = () => void loadState();
    window.addEventListener("nikki:onboarding-updated", onRestart);
    return () => window.removeEventListener("nikki:onboarding-updated", onRestart);
  }, [loadState]);

  const activeTour =
    ALL_TOURS.find((t) => t.id === (state?.currentTourId || INITIAL_TOUR_ID)) ?? ALL_TOURS[0]!;
  const visibleSteps: TourStepConfig[] = activeTour.steps.filter(
    (s) => !(s.advancedOnly && interfaceMode === "simple")
  );
  const stepIndex = Math.min(state?.currentStepIndex ?? 0, Math.max(0, visibleSteps.length - 1));
  const currentStep = visibleSteps[stepIndex];

  useEffect(() => {
    if (!state || state.tourStatus !== "in_progress" || !currentStep) {
      setTargetRect(null);
      return;
    }

    if (pathname !== currentStep.route) {
      router.push(currentStep.route);
    }

    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.targetSelector);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [state, currentStep, pathname, router]);

  async function patchState(patch: Record<string, unknown>) {
    const res = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { state: OnboardingStatePayload } };
      if (json.data?.state) setState(json.data.state);
    }
  }

  async function applyModeAndStart(startTour: boolean) {
    setInterfaceMode(selectedMode);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { interfaceMode: selectedMode } }),
    });
    await patchState({
      welcomeCompleted: true,
      tourStatus: startTour ? "in_progress" : "skipped",
      currentTourId: INITIAL_TOUR_ID,
      currentStepIndex: 0,
    });
  }

  if (!state) return null;

  // 1. First-time Welcome Card
  if (!state.welcomeCompleted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            Bem-vindo ao Nikki
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Seu espaço pessoal para organizar tarefas, rotina, agenda, estudos, viagens e finanças em um só lugar.
          </p>

          <div className="space-y-2">
            <div className="text-xs font-medium">Escolha como prefere começar:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedMode("simple")}
                className={`rounded-xl border p-3 text-left ${
                  selectedMode === "simple"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="font-semibold">Modo Simples</div>
                <div className="mt-0.5 text-[var(--muted-foreground)]">
                  Navegação enxuta com os módulos essenciais.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode("advanced")}
                className={`rounded-xl border p-3 text-left ${
                  selectedMode === "advanced"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="font-semibold">Modo Avançado</div>
                <div className="mt-0.5 text-[var(--muted-foreground)]">
                  Acesso completo a todos os recursos e ferramentas.
                </div>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => void applyModeAndStart(false)}
              className="rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-medium"
            >
              Pular Tour
            </button>
            <button
              type="button"
              onClick={() => void applyModeAndStart(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-white"
            >
              <Compass className="h-4 w-4" /> Iniciar Tour Guiado
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Guided Tour Popover / Bottom Sheet
  if (state.tourStatus !== "in_progress" || !currentStep) return null;

  const isLast = stepIndex >= visibleSteps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/35" />

      {targetRect && (
        <div
          className="absolute rounded-xl border-2 border-[var(--accent)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-all duration-200"
          style={{
            top: Math.max(4, targetRect.top - 4),
            left: Math.max(4, targetRect.left - 4),
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}

      <div className="pointer-events-auto fixed bottom-4 left-4 right-4 mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl md:bottom-6 md:right-6 md:left-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-[var(--accent)]">
              {activeTour.title} · Etapa {stepIndex + 1} de {visibleSteps.length}
            </div>
            <h3 className="mt-0.5 text-sm font-semibold">{currentStep.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => void patchState({ tourStatus: "skipped" })}
            aria-label="Fechar tour"
            className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          {currentStep.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void patchState({ tourStatus: "skipped" })}
            className="text-xs text-[var(--muted-foreground)] hover:underline"
          >
            Pular
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => void patchState({ currentStepIndex: stepIndex - 1 })}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  void patchState({
                    tourStatus: "completed",
                    completeTourId: activeTour.id,
                  });
                } else {
                  void patchState({ currentStepIndex: stepIndex + 1 });
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white"
            >
              {isLast ? "Concluir" : "Avançar"} {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
