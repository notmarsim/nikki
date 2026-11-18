export const SUPPORTED_SNIPPET_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "c",
  "cpp",
  "java",
  "bash",
  "sql",
  "assembly",
  "json",
  "yaml",
  "toml",
  "markdown",
] as const;

export const SUPPORTED_COMMAND_PLATFORMS = [
  "linux",
  "macos",
  "windows",
  "docker",
  "git",
  "postgres",
  "node",
  "ssh",
  "adb",
  "cross-platform",
] as const;

export function extractCommandPlaceholders(command: string): string[] {
  const matches = command.matchAll(/\{([a-zA-Z0-9_.-]+)\}/g);
  const seen = new Set<string>();
  for (const m of matches) {
    if (m[1]) seen.add(m[1]);
  }
  return Array.from(seen);
}

export function interpolateCommand(
  command: string,
  values: Record<string, string>
): string {
  return command.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (full, name: string) => {
    const val = values[name];
    return val !== undefined && val !== "" ? val : full;
  });
}
