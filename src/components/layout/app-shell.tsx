"use client";

import React from "react";
import { CommandPalette } from "./command-palette";
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
    <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar workspaceName={workspaceName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={user.name} userEmail={user.email} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      <CommandPalette />
      <QuickCaptureModal />
    </div>
  );
}
