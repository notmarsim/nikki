export type ModuleStatus = "active" | "in_progress" | "planned";

export type ModuleSection =
  | "core"
  | "productivity"
  | "planning"
  | "knowledge"
  | "system";

export interface AppModule {
  id: string;
  name: string;
  href: string;
  icon: string;
  section: ModuleSection;
  phase: 1 | 2 | 3 | 4 | 5;
  status: ModuleStatus;
  description: string;
  plannedFeatures: string[];
}

export const MODULE_SECTIONS: Record<ModuleSection, string> = {
  core: "Core",
  productivity: "Productivity",
  planning: "Planning & Growth",
  knowledge: "Knowledge & Dev",
  system: "System",
};

export const APP_MODULES: AppModule[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    section: "core",
    phase: 1,
    status: "active",
    description: "Central modular overview of your Nikki workspace.",
    plannedFeatures: [
      "Customizable widget grid",
      "Real-time cross-module summaries",
      "Quick actions and workspace overview",
    ],
  },
  {
    id: "inbox",
    name: "Inbox",
    href: "/inbox",
    icon: "Inbox",
    section: "core",
    phase: 2,
    status: "active",
    description: "Universal quick capture for thoughts, links, tasks, and snippets.",
    plannedFeatures: [
      "Global capture shortcut from any route",
      "Convert entries into Notes, Tasks, or Bookmarks",
      "Triage queue with archive and project linking",
    ],
  },
  {
    id: "notes",
    name: "Notes",
    href: "/notes",
    icon: "FileText",
    section: "productivity",
    phase: 2,
    status: "active",
    description: "Block-based knowledge editor with bidirectional [[links]].",
    plannedFeatures: [
      "Structured JSON block tree (no raw HTML storage)",
      "Slash commands, Mermaid diagrams, KaTeX math, code blocks",
      "Bidirectional [[Page Links]] and backlinks panel",
    ],
  },
  {
    id: "tasks",
    name: "Tasks",
    href: "/tasks",
    icon: "CheckSquare",
    section: "productivity",
    phase: 2,
    status: "active",
    description: "Task management with subtasks, priorities, recurrence, and views.",
    plannedFeatures: [
      "List, Kanban, Today, Upcoming, and Overdue views",
      "Convert note blocks into tasks",
      "Automatic project progress updates",
    ],
  },
  {
    id: "projects",
    name: "Projects",
    href: "/projects",
    icon: "FolderKanban",
    section: "productivity",
    phase: 2,
    status: "active",
    description: "Dedicated project spaces with milestones, docs, and roadmaps.",
    plannedFeatures: [
      "Overview, Kanban, List, Timeline, and Roadmap views",
      "Milestones, technical decisions, and bug logs",
      "Linked notes, tasks, and time tracking",
    ],
  },
  {
    id: "calendar",
    name: "Calendar",
    href: "/calendar",
    icon: "Calendar",
    section: "planning",
    phase: 3,
    status: "active",
    description: "Time blocking, events, and scheduled task execution.",
    plannedFeatures: [
      "Day, Week, and Month interactive views",
      "Drag-and-drop time blocking for tasks",
      "Conflict detection and timezone awareness",
    ],
  },
  {
    id: "learning",
    name: "Learning",
    href: "/learning",
    icon: "GraduationCap",
    section: "planning",
    phase: 3,
    status: "active",
    description: "Learning paths, courses, modules, lessons, and study tracking.",
    plannedFeatures: [
      "Learning Path -> Course -> Module -> Lesson hierarchy",
      "Linked notes, tasks, and focus sessions",
      "Real completion-based progress tracking",
    ],
  },
  {
    id: "flashcards",
    name: "Flashcards",
    href: "/flashcards",
    icon: "Layers",
    section: "planning",
    phase: 3,
    status: "active",
    description: "Spaced repetition decks and FSRS review sessions.",
    plannedFeatures: [
      "Basic, Reversed, and Cloze cards",
      "FSRS spaced repetition scheduling",
      "Generate cards from Notes",
    ],
  },
  {
    id: "habits",
    name: "Habits",
    href: "/habits",
    icon: "Flame",
    section: "planning",
    phase: 3,
    status: "active",
    description: "Daily and weekly habits with streaks and contribution heatmaps.",
    plannedFeatures: [
      "Quantitative goals and consistency rate",
      "GitHub-style contribution heatmap",
      "Optional Focus & Learning verification",
    ],
  },
  {
    id: "focus",
    name: "Focus",
    href: "/focus",
    icon: "Timer",
    section: "planning",
    phase: 3,
    status: "active",
    description: "Pomodoro and reliable timestamp-based time tracking.",
    plannedFeatures: [
      "Reload-safe server-timestamped timer",
      "Link sessions to Tasks, Projects, and Courses",
      "Activity reports and duplicate-session prevention",
    ],
  },
  {
    id: "knowledge-graph",
    name: "Knowledge Graph",
    href: "/knowledge-graph",
    icon: "Network",
    section: "knowledge",
    phase: 4,
    status: "active",
    description: "Interactive graph of bidirectional note and entity relationships.",
    plannedFeatures: [
      "Global and local node neighborhood graphs",
      "Tag filtering, zoom/pan, and direct navigation",
      "Database-backed entity_relations visualization",
    ],
  },
  {
    id: "bookmarks",
    name: "Bookmarks",
    href: "/bookmarks",
    icon: "Bookmark",
    section: "knowledge",
    phase: 4,
    status: "active",
    description: "Curated digital library with SSRF-safe metadata extraction.",
    plannedFeatures: [
      "Collections, tags, and reading status",
      "Safe OpenGraph metadata fetcher",
      "Linked notes and full-text search",
    ],
  },
  {
    id: "developer-hub",
    name: "Developer Hub",
    href: "/developer-hub",
    icon: "Code2",
    section: "knowledge",
    phase: 4,
    status: "active",
    description: "Code snippets, API references, debugging notes, and GitHub links.",
    plannedFeatures: [
      "Syntax-highlighted snippet library",
      "Frequent commands and debugging logs",
      "Scoped GitHub repository integration",
    ],
  },
  {
    id: "search",
    name: "Search",
    href: "/search",
    icon: "Search",
    section: "knowledge",
    phase: 4,
    status: "active",
    description: "Advanced PostgreSQL full-text and fuzzy search across all modules.",
    plannedFeatures: [
      "Full-text + trigram fuzzy matching",
      "Type, tag, date, and contextual filters",
      "Ranked results with snippet highlights",
    ],
  },
  {
    id: "finances",
    name: "Finances",
    href: "/finances",
    icon: "Wallet",
    section: "system",
    phase: 5,
    status: "planned",
    description: "Personal accounts, budgets, and integer-cents financial tracking.",
    plannedFeatures: [
      "Precision integer-cent monetary storage",
      "Budgets, recurring transactions, and CSV import/export",
      "Logically isolated financial data access",
    ],
  },
  {
    id: "analytics",
    name: "Analytics",
    href: "/analytics",
    icon: "BarChart3",
    section: "system",
    phase: 5,
    status: "planned",
    description: "Weekly reviews and cross-module productivity metrics.",
    plannedFeatures: [
      "Real-data weekly review generator",
      "Task, project, habit, and study time distribution",
      "Zero fabricated metrics",
    ],
  },
  {
    id: "settings",
    name: "Settings",
    href: "/settings",
    icon: "Settings",
    section: "system",
    phase: 1,
    status: "active",
    description: "Account profile, theme preferences, workspaces, and shortcuts.",
    plannedFeatures: [
      "Profile and timezone management",
      "Light / Dark / System theme persistence",
      "Workspace and shortcut configuration",
    ],
  },
];

export function getModuleById(id: string): AppModule | undefined {
  return APP_MODULES.find((mod) => mod.id === id);
}
