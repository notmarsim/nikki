"use client";

import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  quickCaptureOpen: boolean;
  spellcheckEnabled: boolean;
  pinnedModuleIds: string[];
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickCaptureOpen: (open: boolean) => void;
  setSpellcheckEnabled: (enabled: boolean) => void;
  togglePinnedModule: (moduleId: string) => void;
}

const getInitialSpellcheck = (): boolean => {
  if (typeof window === "undefined") return true;
  const saved = window.localStorage.getItem("nikki-spellcheck");
  return saved === null ? true : saved === "true";
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  spellcheckEnabled: getInitialSpellcheck(),
  pinnedModuleIds: ["dashboard", "inbox", "notes", "tasks", "projects"],
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickCaptureOpen: (open) => set({ quickCaptureOpen: open }),
  setSpellcheckEnabled: (enabled) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nikki-spellcheck", String(enabled));
    }
    set({ spellcheckEnabled: enabled });
  },
  togglePinnedModule: (moduleId) =>
    set((state) => ({
      pinnedModuleIds: state.pinnedModuleIds.includes(moduleId)
        ? state.pinnedModuleIds.filter((id) => id !== moduleId)
        : [...state.pinnedModuleIds, moduleId],
    })),
}));
