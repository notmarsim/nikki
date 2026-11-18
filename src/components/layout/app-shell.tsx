"use client";

import React from "react";
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
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar workspaceName={workspaceName} />
      <div className="pt-safe flex flex-1 flex-col overflow-hidden">
        <Topbar userName={user.name} userEmail={user.email} />
        <main className="flex-1 overflow-y-auto p-3 pb-24 sm:p-6 md:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav />
      <CommandPalette />
      <QuickCaptureModal />
    </div>
  );
}
