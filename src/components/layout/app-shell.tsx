"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { CommandPalette } from "./command-palette";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { QuickCaptureModal } from "./quick-capture-modal";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  user: {
    name: string;
    email: string;
  };
  workspaceName: string;
  children: React.ReactNode;
}

export function AppShell({ user, workspaceName, children }: AppShellProps) {
  const mobileSidebarOpen = useUiStore((s) => s.mobileSidebarOpen);

  return (
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
    </div>
  );
}
