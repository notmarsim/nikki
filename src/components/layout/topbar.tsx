"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Monitor, Moon, Plus, Search, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

interface TopbarProps {
  userName: string;
  userEmail: string;
}

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function Topbar({ userName, userEmail }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { setMobileSidebarOpen, setCommandPaletteOpen, setQuickCaptureOpen } = useUiStore();

  const handleCycleTheme = async () => {
    const next = NEXT_THEME[theme];
    setTheme(next);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => undefined);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex h-9 w-56 sm:w-72 items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
          aria-label="Open Command Palette"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search modules & commands...</span>
          </span>
          <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-mono">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickCaptureOpen(true)}
          title="Quick Capture (Ctrl+Shift+I)"
          className="hidden sm:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" />
          Capture
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleCycleTheme}
          title={`Theme: ${theme} (click to switch)`}
          aria-label={`Switch theme (current: ${theme})`}
        >
          {theme === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : theme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </Button>

        <div className="hidden sm:flex flex-col items-end px-2">
          <span className="text-xs font-medium leading-tight">{userName}</span>
          <span className="text-[11px] text-[var(--muted-foreground)] leading-tight">
            {userEmail}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
