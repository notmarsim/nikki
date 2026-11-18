"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Command, Search } from "lucide-react";
import { APP_MODULES } from "@/config/modules";
import { useTheme } from "@/components/providers/theme-provider";
import { ModuleIcon } from "@/components/ui/module-icon";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

interface PaletteItem {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { commandPaletteOpen, setCommandPaletteOpen, toggleSidebar } = useUiStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (event.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const items: PaletteItem[] = useMemo(() => {
    const moduleItems: PaletteItem[] = APP_MODULES.map((mod) => ({
      id: `nav-${mod.id}`,
      label: mod.name,
      subtitle:
        mod.status === "active"
          ? `Go to ${mod.name}`
          : `${mod.name} (Phase ${mod.phase} — Planned)`,
      icon: mod.icon,
      action: () => {
        router.push(mod.href);
        setCommandPaletteOpen(false);
      },
    }));

    const quickCommands: PaletteItem[] = [
      {
        id: "cmd-theme-dark",
        label: "Theme: Switch to Dark Mode",
        subtitle: "Appearance",
        icon: "Settings",
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
        action: () => {
          toggleSidebar();
          setCommandPaletteOpen(false);
        },
      },
    ];

    return [...moduleItems, ...quickCommands];
  }, [router, setCommandPaletteOpen, setTheme, toggleSidebar]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (event.key === "Enter" && filtered[selectedIndex]) {
      event.preventDefault();
      filtered[selectedIndex].action();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] px-4"
      onClick={() => setCommandPaletteOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
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
            placeholder="Type a command or search modules..."
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
          />
          <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              No matching commands or modules.
            </div>
          ) : (
            filtered.map((item, idx) => (
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
                  <ModuleIcon name={item.icon} className="h-4 w-4 shrink-0" />
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
            <Command className="h-3 w-3" /> Personal OS Command Palette
          </span>
          <span>↑↓ Navigate · ↵ Select</span>
        </div>
      </div>
    </div>
  );
}
