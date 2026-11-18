export interface KeybindingsConfig {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  code: string;
  highlight: string;
  checklist: string;
  toTask: string;
  commandPalette: string;
  quickCapture: string;
}

export const DEFAULT_KEYBINDINGS: KeybindingsConfig = {
  bold: "Ctrl+B",
  italic: "Ctrl+I",
  underline: "Ctrl+U",
  strike: "Ctrl+Shift+S",
  code: "Ctrl+E",
  highlight: "Ctrl+Shift+H",
  checklist: "Ctrl+Shift+9",
  toTask: "Ctrl+Shift+T",
  commandPalette: "Ctrl+K",
  quickCapture: "Ctrl+Shift+I",
};

export const KEYBINDING_LABELS: Record<keyof KeybindingsConfig, string> = {
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strike: "Strikethrough",
  code: "Inline Code",
  highlight: "Highlight",
  checklist: "Checklist",
  toTask: "Convert Selection to Task",
  commandPalette: "Command Palette / Search",
  quickCapture: "Quick Capture (Inbox)",
};

export function formatKeyEventToCombo(event: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = event.key;
  if (
    key === "Control" ||
    key === "Shift" ||
    key === "Alt" ||
    key === "Meta"
  ) {
    return null;
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  const normalizedKey =
    key.length === 1 ? key.toUpperCase() : key;
  parts.push(normalizedKey);

  return parts.join("+");
}

export function matchesKeybinding(
  event: KeyboardEvent | React.KeyboardEvent,
  combo: string
): boolean {
  if (!combo) return false;
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  const needCtrl = parts.includes("ctrl") || parts.includes("cmd") || parts.includes("mod");
  const needAlt = parts.includes("alt");
  const needShift = parts.includes("shift");
  const mainKey = parts.find(
    (p) => p !== "ctrl" && p !== "cmd" && p !== "mod" && p !== "alt" && p !== "shift"
  );

  if (!mainKey) return false;
  const hasCtrl = event.ctrlKey || event.metaKey;
  if (hasCtrl !== needCtrl) return false;
  if (event.altKey !== needAlt) return false;
  if (event.shiftKey !== needShift) return false;

  return event.key.toLowerCase() === mainKey;
}
