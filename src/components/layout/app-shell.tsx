"use client";

import React, { useEffect } from "react";
import { applyUserPreferences } from "@/lib/apply-preferences";
import { cn } from "@/lib/utils";
import type { UserPreferences } from "@/modules/settings/registry";
import { useUiStore } from "@/stores/ui-store";
import { CommandPalette } from "./command-palette";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { QuickCaptureModal } from "./quick-capture-modal";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { OnboardingTourOverlay } from "@/components/onboarding/onboarding-tour";
import { I18nProvider } from "@/components/providers/i18n-provider";

interface AppShellProps {
  user: {
    name: string;
    email: string;
  };
  workspaceName: string;
  initialPreferences?: UserPreferences;
  children: React.ReactNode;
}

export function AppShell({
  user,
  workspaceName,
  initialPreferences,
  children,
}: AppShellProps) {
  const mobileSidebarOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setHiddenModuleIds = useUiStore((s) => s.setHiddenModuleIds);
  const setInterfaceMode = useUiStore((s) => s.setInterfaceMode);

  useEffect(() => {
    if (!initialPreferences) return;
    applyUserPreferences(initialPreferences);
    setHiddenModuleIds(initialPreferences.hiddenModuleIds);
    setInterfaceMode(initialPreferences.interfaceMode);
  }, [initialPreferences, setHiddenModuleIds, setInterfaceMode]);

  return (
    <I18nProvider initialLanguage={initialPreferences?.language ?? "en-US"}>
      <div className="flex h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <Sidebar workspaceName={workspaceName} />
        <div className="pt-safe flex flex-1 flex-col overflow-hidden">
          <Topbar userName={user.name} userEmail={user.email} />
          <main
            className={cn(
              "flex-1 p-3 pb-24 sm:p-6 md:pb-6",
              mobileSidebarOpen
                ? "overflow-hidden touch-none md:overflow-y-auto md:touch-auto"
                : "overflow-y-auto"
            )}
          >
            {children}
          </main>
        </div>
        <MobileBottomNav />
        <CommandPalette />
        <QuickCaptureModal />
        <OnboardingTourOverlay />
      </div>
    </I18nProvider>
  );
}
