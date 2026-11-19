"use client";

import { create } from "zustand";
import {
  DEFAULT_KEYBINDINGS,
  type KeybindingsConfig,
} from "@/lib/keybindings";

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  quickCaptureOpen: boolean;
  spellcheckEnabled: boolean;
  keybindings: KeybindingsConfig;
  pinnedModuleIds: string[];
  hiddenModuleIds: string[];
  interfaceMode: "simple" | "advanced";
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickCaptureOpen: (open: boolean) => void;
  setSpellcheckEnabled: (enabled: boolean) => void;
  setKeybinding: (action: keyof KeybindingsConfig, combo: string) => void;
  resetKeybindings: () => void;
  togglePinnedModule: (moduleId: string) => void;
  setHiddenModuleIds: (ids: string[]) => void;
  setInterfaceMode: (mode: "simple" | "advanced") => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  spellcheckEnabled: true,
  keybindings: DEFAULT_KEYBINDINGS,
  pinnedModuleIds: ["dashboard", "inbox", "notes", "tasks", "projects"],
  hiddenModuleIds: [],
  interfaceMode: "advanced",
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
  setKeybinding: (action, combo) =>
    set((state) => {
      const next = { ...state.keybindings, [action]: combo };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("nikki-keybindings", JSON.stringify(next));
      }
      return { keybindings: next };
    }),
  resetKeybindings: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("nikki-keybindings");
    }
    set({ keybindings: DEFAULT_KEYBINDINGS });
  },
  togglePinnedModule: (moduleId) =>
    set((state) => ({
      pinnedModuleIds: state.pinnedModuleIds.includes(moduleId)
        ? state.pinnedModuleIds.filter((id) => id !== moduleId)
        : [...state.pinnedModuleIds, moduleId],
    })),
  setHiddenModuleIds: (ids) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("nikki-hidden-modules", JSON.stringify(ids));
    }
    set({ hiddenModuleIds: ids });
  },
  setInterfaceMode: (mode) => set({ interfaceMode: mode }),
}));
