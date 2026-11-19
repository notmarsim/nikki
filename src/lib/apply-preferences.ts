import type { UserPreferences } from "@/modules/settings/registry";

export function applyUserPreferences(prefs: UserPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (prefs.accentColor) {
    root.style.setProperty("--accent", prefs.accentColor);
  }
  root.dataset.density = prefs.density;
  root.dataset.fontSize = prefs.fontSize;
  root.dataset.animations = prefs.animations;
  root.dataset.highContrast = String(prefs.highContrast);
  root.dataset.focusIndicators = String(prefs.focusIndicators);
}
