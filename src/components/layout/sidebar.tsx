"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Pin,
  X,
} from "lucide-react";
import {
  APP_MODULES,
  MODULE_SECTIONS,
  type ModuleSection,
} from "@/config/modules";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { ModuleIcon } from "@/components/ui/module-icon";

interface SidebarProps {
  workspaceName: string;
}

const SECTION_ORDER: ModuleSection[] = [
  "core",
  "productivity",
  "planning",
  "knowledge",
  "system",
];

export function Sidebar({ workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    pinnedModuleIds,
    togglePinnedModule,
    hiddenModuleIds,
  } = useUiStore();

  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const pinnedModules = APP_MODULES.filter(
    (m) => pinnedModuleIds.includes(m.id) && !hiddenModuleIds.includes(m.id)
  );

  const renderNavContent = (isMobile = false) => {
    const collapsed = isMobile ? false : sidebarCollapsed;

    return (
      <div className="flex h-full flex-col bg-[var(--surface)] border-r border-[var(--border)]">
        {/* Workspace Header */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
            onClick={() => isMobile && setMobileSidebarOpen(false)}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]">
              <Layers className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-semibold leading-tight">
                  Nikki
                </span>
                <span className="text-xs text-[var(--muted-foreground)] truncate">
                  {workspaceName}
                </span>
              </div>
            )}
          </Link>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav
          className="flex-1 overflow-y-auto px-2 py-3 space-y-4"
          aria-label="Main Navigation"
        >
          {/* Pinned Section */}
          {!collapsed && pinnedModules.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                <Pin className="h-3 w-3" />
                <span>Pinned</span>
              </div>
              <div className="space-y-0.5">
                {pinnedModules.map((mod) => {
                  const isActive = pathname === mod.href;
                  return (
                    <Link
                      key={`pinned-${mod.id}`}
                      href={mod.href}
                      onClick={() => isMobile && setMobileSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <ModuleIcon name={mod.icon} className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{mod.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grouped Module Sections */}
          {SECTION_ORDER.map((sectionKey) => {
            const sectionModules = APP_MODULES.filter(
              (m) =>
                m.section === sectionKey &&
                (m.id === "settings" || !hiddenModuleIds.includes(m.id))
            );
            const isSectionCollapsed = collapsedSections[sectionKey] ?? false;

            return (
              <div key={sectionKey}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleSection(sectionKey)}
                    className="mb-1 flex w-full items-center justify-between px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <span>{MODULE_SECTIONS[sectionKey]}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform",
                        isSectionCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                )}

                {(!isSectionCollapsed || collapsed) && (
                  <div className="space-y-0.5">
                    {sectionModules.map((mod) => {
                      const isActive = pathname === mod.href;
                      const isPinned = pinnedModuleIds.includes(mod.id);

                      return (
                        <div key={mod.id} className="group relative flex items-center">
                          <Link
                            href={mod.href}
                            onClick={() => isMobile && setMobileSidebarOpen(false)}
                            title={collapsed ? mod.name : undefined}
                            className={cn(
                              "flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                              collapsed && "justify-center px-0",
                              isActive
                                ? "bg-[var(--surface-muted)] font-medium text-[var(--foreground)]"
                                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                            )}
                            aria-current={isActive ? "page" : undefined}
                          >
                            <ModuleIcon
                              name={mod.icon}
                              className="h-4 w-4 shrink-0"
                            />
                            {!collapsed && (
                              <>
                                <span className="truncate flex-1">{mod.name}</span>
                                {mod.status === "planned" && (
                                  <span className="text-[10px] rounded px-1.5 py-0.5 bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
                                    P{mod.phase}
                                  </span>
                                )}
                              </>
                            )}
                          </Link>

                          {!collapsed && (
                            <button
                              type="button"
                              onClick={() => togglePinnedModule(mod.id)}
                              className={cn(
                                "mr-1 rounded p-1 text-[var(--muted-foreground)] opacity-0 transition-opacity hover:text-[var(--foreground)] group-hover:opacity-100",
                                isPinned && "opacity-60 text-[var(--accent)]"
                              )}
                              aria-label={isPinned ? `Unpin ${mod.name}` : `Pin ${mod.name}`}
                              title={isPinned ? "Unpin" : "Pin to top"}
                            >
                              <Pin className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar (completely hidden when collapsed) */}
      <aside
        className={cn(
          "hidden md:block shrink-0 overflow-hidden transition-all duration-200",
          sidebarCollapsed ? "w-0 border-r-0" : "w-64"
        )}
        aria-hidden={sidebarCollapsed}
      >
        <div className="h-full w-64">{renderNavContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw]">
            {renderNavContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
