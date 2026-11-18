"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { APP_MODULES, MODULE_SECTIONS, type ModuleSection } from "@/config/modules";
import { ModuleIcon } from "@/components/ui/module-icon";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

const PRIMARY_IDS = ["dashboard", "notes", "tasks", "finances"] as const;
const SECTION_ORDER: ModuleSection[] = [
  "core",
  "productivity",
  "planning",
  "knowledge",
  "system",
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const hiddenModuleIds = useUiStore((s) => s.hiddenModuleIds);

  const primaryModules = PRIMARY_IDS.map((id) => APP_MODULES.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m) && !hiddenModuleIds.includes(m!.id));

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-[var(--border)] bg-[var(--surface)]/95 px-1 pt-1 backdrop-blur md:hidden"
      >
        {primaryModules.map((mod) => {
          const isActive = pathname === mod.href;
          return (
            <Link
              key={mod.id}
              href={mod.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              <ModuleIcon name={mod.icon} className="h-5 w-5" />
              <span className="truncate">{mod.name}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More modules"
          className={cn(
            "flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
            moreOpen
              ? "text-[var(--accent)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="pb-safe max-h-[78dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">All Modules</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]"
                aria-label="Close modules menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {SECTION_ORDER.map((section) => {
                const mods = APP_MODULES.filter(
                  (m) =>
                    m.section === section &&
                    (m.id === "settings" || !hiddenModuleIds.includes(m.id))
                );
                if (mods.length === 0) return null;
                return (
                  <div key={section}>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {MODULE_SECTIONS[section]}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {mods.map((mod) => {
                        const isActive = pathname === mod.href;
                        return (
                          <Link
                            key={mod.id}
                            href={mod.href}
                            onClick={() => setMoreOpen(false)}
                            className={cn(
                              "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-xs transition-colors",
                              isActive
                                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                                : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface-muted)]"
                            )}
                          >
                            <ModuleIcon name={mod.icon} className="h-4 w-4" />
                            <span className="truncate w-full">{mod.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
