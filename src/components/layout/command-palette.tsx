"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckSquare,
  Command,
  FileText,
  FolderKanban,
  Inbox,
  Search,
} from "lucide-react";
import { APP_MODULES } from "@/config/modules";
import { useTheme } from "@/components/providers/theme-provider";
import { ModuleIcon } from "@/components/ui/module-icon";
import { matchesKeybinding } from "@/lib/keybindings";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

interface SearchResultItem {
  id: string;
  type:
    | "note"
    | "task"
    | "project"
    | "course"
    | "lesson"
    | "event"
    | "deck"
    | "habit"
    | "bookmark"
    | "snippet"
    | "command"
    | "reference";
  title: string;
  snippet: string;
  href: string;
}

interface PaletteItem {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  group: string;
  action: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setQuickCaptureOpen,
    toggleSidebar,
    keybindings,
  } = useUiStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (matchesKeybinding(event, keybindings.commandPalette)) {
        event.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (event.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen, keybindings.commandPalette]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!commandPaletteOpen || trimmed.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}&limit=12`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json?.data?.results ?? []);
        }
      } catch {
        // Ignore aborted requests
      } finally {
        setSearching(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, commandPaletteOpen]);

  const staticItems: PaletteItem[] = useMemo(() => {
    const quickActions: PaletteItem[] = [
      {
        id: "act-quick-capture",
        label: "Quick Capture to Inbox",
        subtitle: "Capture thought, link, or task (Ctrl+Shift+I)",
        icon: "Inbox",
        group: "Actions",
        action: () => {
          setCommandPaletteOpen(false);
          setQuickCaptureOpen(true);
        },
      },
      {
        id: "act-new-note",
        label: "New Note",
        subtitle: "Open Notes workspace",
        icon: "FileText",
        group: "Actions",
        action: () => {
          router.push("/notes?new=1");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-new-task",
        label: "New Task",
        subtitle: "Open Tasks workspace",
        icon: "CheckSquare",
        group: "Actions",
        action: () => {
          router.push("/tasks?new=1");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-new-event",
        label: "Create Event",
        subtitle: "Schedule event or time block in Calendar",
        icon: "Calendar",
        group: "Actions",
        action: () => {
          router.push("/calendar");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-start-focus",
        label: "Start Focus Session",
        subtitle: "Open Pomodoro & Stopwatch timer",
        icon: "Timer",
        group: "Actions",
        action: () => {
          router.push("/focus");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-review-flashcards",
        label: "Review Flashcards",
        subtitle: "Practice spaced repetition decks",
        icon: "Layers",
        group: "Actions",
        action: () => {
          router.push("/flashcards");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-create-course",
        label: "Create Course",
        subtitle: "Open Learning Hub",
        icon: "GraduationCap",
        group: "Actions",
        action: () => {
          router.push("/learning");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-create-habit",
        label: "Create Habit",
        subtitle: "Track daily habits & streaks",
        icon: "Flame",
        group: "Actions",
        action: () => {
          router.push("/habits");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-knowledge-graph",
        label: "Open Knowledge Graph",
        subtitle: "Explore interactive connections across Nikki",
        icon: "Network",
        group: "Actions",
        action: () => {
          router.push("/knowledge-graph");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-bookmarks",
        label: "Save Bookmark",
        subtitle: "Open Bookmarks & Digital Library",
        icon: "Bookmark",
        group: "Actions",
        action: () => {
          router.push("/bookmarks");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-dev-hub",
        label: "Open Developer Hub",
        subtitle: "Snippets, commands, cheatsheets, and GitHub",
        icon: "Code2",
        group: "Actions",
        action: () => {
          router.push("/developer-hub");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-advanced-search",
        label: "Advanced Global Search",
        subtitle: "Search with FTS, fuzzy matching, and filters",
        icon: "Search",
        group: "Actions",
        action: () => {
          router.push("/search");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-open-finances",
        label: "Open Personal Finances",
        subtitle: "Accounts, credit cards, budgets, and goals",
        icon: "Wallet",
        group: "Actions",
        action: () => {
          router.push("/finances");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-open-analytics",
        label: "Open Advanced Analytics",
        subtitle: "Cross-module metrics and custom reports",
        icon: "BarChart3",
        group: "Actions",
        action: () => {
          router.push("/analytics");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "act-open-settings",
        label: "Open Settings & Personalization",
        subtitle: "Profile, appearance, privacy, and shortcuts",
        icon: "Settings",
        group: "Actions",
        action: () => {
          router.push("/settings");
          setCommandPaletteOpen(false);
        },
      },
    ];

    const moduleItems: PaletteItem[] = APP_MODULES.map((mod) => ({
      id: `nav-${mod.id}`,
      label: mod.name,
      subtitle:
        mod.status === "active"
          ? `Go to ${mod.name}`
          : `${mod.name} (Phase ${mod.phase} — Planned)`,
      icon: mod.icon,
      group: "Modules",
      action: () => {
        router.push(mod.href);
        setCommandPaletteOpen(false);
      },
    }));

    const appearanceItems: PaletteItem[] = [
      {
        id: "cmd-theme-dark",
        label: "Theme: Switch to Dark Mode",
        subtitle: "Appearance",
        icon: "Settings",
        group: "Preferences",
        action: () => {
          setTheme("dark");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "cmd-theme-light",
        label: "Theme: Switch to Light Mode",
        subtitle: "Appearance",
        icon: "Settings",
        group: "Preferences",
        action: () => {
          setTheme("light");
          setCommandPaletteOpen(false);
        },
      },
      {
        id: "cmd-toggle-sidebar",
        label: "Toggle Sidebar",
        subtitle: "Layout",
        icon: "Layers",
        group: "Preferences",
        action: () => {
          toggleSidebar();
          setCommandPaletteOpen(false);
        },
      },
    ];

    return [...quickActions, ...moduleItems, ...appearanceItems];
  }, [router, setCommandPaletteOpen, setQuickCaptureOpen, setTheme, toggleSidebar]);

  const items: PaletteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dbItems: PaletteItem[] = searchResults.map((res) => ({
      id: `search-${res.type}-${res.id}`,
      label: res.title,
      subtitle: `${res.type.toUpperCase()}${res.snippet ? ` · ${res.snippet.replace(/<[^>]+>/g, "")}` : ""}`,
      icon:
        res.type === "note"
          ? "FileText"
          : res.type === "task"
            ? "CheckSquare"
            : res.type === "project"
              ? "FolderKanban"
              : res.type === "course" || res.type === "lesson"
                ? "GraduationCap"
                : res.type === "event"
                  ? "Calendar"
                  : res.type === "deck"
                    ? "Layers"
                    : res.type === "bookmark"
                      ? "Bookmark"
                      : res.type === "snippet" ||
                          res.type === "command" ||
                          res.type === "reference"
                        ? "Code2"
                        : "Flame",
      group: "Search Results",
      action: () => {
        router.push(res.href);
        setCommandPaletteOpen(false);
      },
    }));

    const matchingStatic = q
      ? staticItems.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        )
      : staticItems;

    return [...dbItems, ...matchingStatic];
  }, [query, searchResults, staticItems, router, setCommandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) =>
        items.length ? (prev - 1 + items.length) % items.length : 0
      );
    } else if (event.key === "Enter" && items[selectedIndex]) {
      event.preventDefault();
      items[selectedIndex].action();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[14vh] px-4"
      onClick={() => setCommandPaletteOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Global Search & Command Palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, tasks, projects, or type a command..."
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
          />
          {searching && (
            <span className="text-[11px] text-[var(--muted-foreground)]">Searching...</span>
          )}
          <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              No matching notes, tasks, projects, or commands.
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  idx === selectedIndex
                    ? "bg-[var(--surface-muted)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {item.icon === "FileText" ? (
                    <FileText className="h-4 w-4 shrink-0" />
                  ) : item.icon === "CheckSquare" ? (
                    <CheckSquare className="h-4 w-4 shrink-0" />
                  ) : item.icon === "FolderKanban" ? (
                    <FolderKanban className="h-4 w-4 shrink-0" />
                  ) : item.icon === "Inbox" ? (
                    <Inbox className="h-4 w-4 shrink-0" />
                  ) : (
                    <ModuleIcon name={item.icon} className="h-4 w-4 shrink-0" />
                  )}
                  <div className="truncate">
                    <div className="font-medium text-[var(--foreground)] truncate">
                      {item.label}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] truncate">
                      {item.subtitle}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" /> Nikki Command Palette & Global Search
          </span>
          <span>↑↓ Navigate · ↵ Open</span>
        </div>
      </div>
    </div>
  );
}
