export type AppLanguage = "en-US" | "pt-BR";

export const MODULE_NAMES_PT: Record<string, string> = {
  dashboard: "Painel",
  inbox: "Caixa de Entrada",
  search: "Busca",
  spaces: "Espaços",
  notes: "Notas",
  tasks: "Tarefas",
  projects: "Projetos",
  archive: "Arquivo",
  calendar: "Calendário",
  learning: "Estudos",
  flashcards: "Flashcards",
  habits: "Hábitos",
  focus: "Foco",
  goals: "Metas",
  journal: "Diário",
  home: "Casa",
  "focus-rooms": "Salas de Foco",
  "day-planner": "Planejador do Dia",
  routines: "Rotinas",
  shopping: "Lista de Compras",
  trips: "Viagens",
  "knowledge-graph": "Grafo de Conhecimento",
  bookmarks: "Favoritos",
  "developer-hub": "Dev Hub",
  vault: "Cofre",
  feed: "Feed",
  finances: "Finanças",
  analytics: "Análises",
  templates: "Modelos",
  subscriptions: "Assinaturas",
  settings: "Configurações",
};

export const SECTION_NAMES_I18N: Record<AppLanguage, Record<string, string>> = {
  "en-US": {
    core: "Core",
    productivity: "Productivity",
    planning: "Planning & Growth",
    knowledge: "Knowledge & Dev",
    system: "System",
  },
  "pt-BR": {
    core: "Principal",
    productivity: "Produtividade",
    planning: "Planejamento e Vida",
    knowledge: "Conhecimento e Dev",
    system: "Sistema",
  },
};

const DICT_EN = {
  // Navigation & Shell
  "nav.pinned": "Pinned",
  "nav.space": "Space",
  "topbar.searchPlaceholder": "Search modules & commands...",
  "topbar.more": "More",

  // Dashboard
  "dash.welcome": "Welcome back",
  "dash.newNote": "New Note",
  "dash.newTask": "New Task",
  "dash.projects": "Projects",
  "dash.dismiss": "Dismiss",
  "dash.finTitle": "Financial Snapshot",
  "dash.finPrivacy": "Privacy mode is enabled in Settings.",
  "dash.finDesc": "Real-time account balance and monthly cash flow.",
  "dash.analytics": "Analytics",
  "dash.openFinances": "Open Finances →",
  "dash.balance": "Available Balance",
  "dash.income": "Income",
  "dash.expenses": "Expenses",

  // Tasks
  "tasks.title": "Tasks",
  "tasks.subtitle": "Manage tasks, subtasks, recurrence, dependencies, and Kanban workflows.",
  "tasks.addPlaceholder": "Add a task...",
  "tasks.sortDefault": "Sort: Default",
  "tasks.sortDueSoonest": "Closest due date",
  "tasks.archiveBanner": "Completed tasks remain visible until the end of the week, then move to Archive.",
  "tasks.openArchive": "Open Archive →",
  "tasks.status.todo": "To Do",
  "tasks.status.in_progress": "In Progress",
  "tasks.status.blocked": "Blocked",
  "tasks.status.done": "Done",
  "tasks.status.cancelled": "Cancelled",

  // Vault
  "vault.title": "Document Vault",
  "vault.subtitle": "Keep important personal documents organized with categories and expiration reminders.",

  // Settings
  "settings.title": "Settings & Personalization",
  "settings.subtitle": "Configure profile, language, appearance, modules, financial privacy, and shortcuts.",
  "settings.save": "Save Changes",
  "settings.saving": "Saving...",
  "settings.saved": "Settings saved.",
  "settings.cat.general": "General & Profile",
  "settings.cat.appearance": "Appearance & Accessibility",
  "settings.cat.productivity": "Productivity & Modules",
  "settings.cat.navigation": "Navigation & Shortcuts",
  "settings.cat.finances": "Finances & Privacy",
  "settings.cat.notifications": "Notifications",
  "settings.cat.devices": "App & Devices",
  "settings.cat.data": "Data & Storage",
  "settings.cat.tutorials": "Help & Tutorials",
  "settings.cat.diagnostics": "Help & Diagnostics",
  "settings.language": "Language",
  "settings.currency": "Default Currency",
  "settings.dateFormat": "Date Format",
  "settings.timeFormat": "Time Format",
  "settings.weekStartsOn": "Week Starts On",
  "settings.interfaceMode": "Interface Mode",
  "settings.interfaceModeDesc": "Switch between Simple Mode (essential modules) and Advanced Mode (all modules).",
  "settings.simpleMode": "Simple Mode",
  "settings.simpleModeDesc": "Focus on essential modules: Dashboard, Tasks, Calendar, Notes, Finances, Day Planner, Routines, and Shopping.",
  "settings.advancedMode": "Advanced Mode",
  "settings.advancedModeDesc": "Show all enabled modules, detailed analytics, and advanced tools.",
  "settings.guidedTour": "Guided Tour",
  "settings.guidedTourDesc": "Review Nikki's main features step by step.",
  "settings.redoTour": "Redo Tour",

  // Onboarding
  "tour.welcomeTitle": "Welcome to Nikki",
  "tour.welcomeDesc": "Your personal workspace to organize tasks, routines, calendar, studies, trips, and finances in one place.",
  "tour.chooseMode": "Choose how you prefer to start:",
  "tour.skip": "Skip Tour",
  "tour.start": "Start Guided Tour",
  "tour.stepOf": "Step {current} of {total}",
  "tour.back": "Back",
  "tour.next": "Next",
  "tour.finish": "Finish",

  // Archive
  "archive.title": "Archive & History",
  "archive.subtitle": "Browse, restore, or manage archived completed tasks, projects, and Trash items.",
  "archive.tabTasks": "Tasks",
  "archive.tabProjects": "Projects",
  "archive.tabTrash": "Trash (30 days)",

  // Day Planner
  "planner.title": "Day Planner",
  "planner.subtitle": "Schedule tasks into free time slots around your calendar events, routines, and dependencies.",
  "planner.generate": "Generate Plan",
  "planner.generating": "Planning...",

  // Routines
  "routines.title": "Routines",
  "routines.subtitle": "Build sequential routines with step durations and run them step by step.",

  // Subscriptions
  "subs.title": "Subscription Manager",
  "subs.subtitle": "Track subscriptions, free trials, and monthly/annual equivalent costs.",

  // Shopping
  "shopping.title": "Smart Shopping Lists",
  "shopping.subtitle": "Shared lists via Spaces, history-based item suggestions, and confirmed Finance logging.",

  // Trips
  "trips.title": "Trip Planner",
  "trips.subtitle": "Plan trips, day-by-day itineraries, packing checklists, and sync activities to Calendar.",
} as const;

export type I18nKey = keyof typeof DICT_EN;

const DICT_PT: Record<I18nKey, string> = {
  "nav.pinned": "Fixados",
  "nav.space": "Espaço",
  "topbar.searchPlaceholder": "Buscar módulos e comandos...",
  "topbar.more": "Mais",

  "dash.welcome": "Bem-vindo de volta",
  "dash.newNote": "Nova Nota",
  "dash.newTask": "Nova Tarefa",
  "dash.projects": "Projetos",
  "dash.dismiss": "Dispensar",
  "dash.finTitle": "Resumo Financeiro",
  "dash.finPrivacy": "Modo de privacidade ativado nas Configurações.",
  "dash.finDesc": "Saldo em conta e fluxo de caixa mensal em tempo real.",
  "dash.analytics": "Análises",
  "dash.openFinances": "Abrir Finanças →",
  "dash.balance": "Saldo Disponível",
  "dash.income": "Receitas",
  "dash.expenses": "Despesas",

  "tasks.title": "Tarefas",
  "tasks.subtitle": "Gerencie tarefas, subtarefas, recorrência, dependências e quadros Kanban.",
  "tasks.addPlaceholder": "Adicionar tarefa...",
  "tasks.sortDefault": "Ordenar: Padrão",
  "tasks.sortDueSoonest": "Vencimento mais próximo",
  "tasks.archiveBanner": "Tarefas concluídas permanecem visíveis até o fim da semana e depois vão para o Arquivo.",
  "tasks.openArchive": "Abrir Arquivo →",
  "tasks.status.todo": "A Fazer",
  "tasks.status.in_progress": "Em Progresso",
  "tasks.status.blocked": "Bloqueada",
  "tasks.status.done": "Concluída",
  "tasks.status.cancelled": "Cancelada",

  "vault.title": "Cofre de Documentos",
  "vault.subtitle": "Guarde documentos pessoais importantes com categorias e lembretes de validade.",

  "settings.title": "Configurações e Personalização",
  "settings.subtitle": "Configure perfil, idioma, aparência, módulos, privacidade financeira e atalhos.",
  "settings.save": "Salvar Alterações",
  "settings.saving": "Salvando...",
  "settings.saved": "Configurações salvas.",
  "settings.cat.general": "Geral e Perfil",
  "settings.cat.appearance": "Aparência e Acessibilidade",
  "settings.cat.productivity": "Produtividade e Módulos",
  "settings.cat.navigation": "Navegação e Atalhos",
  "settings.cat.finances": "Finanças e Privacidade",
  "settings.cat.notifications": "Notificações",
  "settings.cat.devices": "Aplicativo e Dispositivos",
  "settings.cat.data": "Dados e Armazenamento",
  "settings.cat.tutorials": "Ajuda e Tutoriais",
  "settings.cat.diagnostics": "Ajuda e Diagnóstico",
  "settings.language": "Idioma",
  "settings.currency": "Moeda Padrão",
  "settings.dateFormat": "Formato de Data",
  "settings.timeFormat": "Formato de Hora",
  "settings.weekStartsOn": "Início da Semana",
  "settings.interfaceMode": "Modo de Interface",
  "settings.interfaceModeDesc": "Alterne entre o Modo Simples (módulos essenciais) e o Modo Avançado (todos os módulos).",
  "settings.simpleMode": "Modo Simples",
  "settings.simpleModeDesc": "Foco nos módulos essenciais: Painel, Tarefas, Calendário, Notas, Finanças, Planejador do Dia, Rotinas e Compras.",
  "settings.advancedMode": "Modo Avançado",
  "settings.advancedModeDesc": "Exibe todos os módulos habilitados, análises detalhadas e ferramentas avançadas.",
  "settings.guidedTour": "Tour Guiado",
  "settings.guidedTourDesc": "Reveja as principais funções do Nikki passo a passo.",
  "settings.redoTour": "Refazer Tour",

  "tour.welcomeTitle": "Bem-vindo ao Nikki",
  "tour.welcomeDesc": "Seu espaço pessoal para organizar tarefas, rotinas, agenda, estudos, viagens e finanças em um só lugar.",
  "tour.chooseMode": "Escolha como prefere começar:",
  "tour.skip": "Pular Tour",
  "tour.start": "Iniciar Tour Guiado",
  "tour.stepOf": "Etapa {current} de {total}",
  "tour.back": "Voltar",
  "tour.next": "Avançar",
  "tour.finish": "Concluir",

  "archive.title": "Arquivo e Histórico",
  "archive.subtitle": "Consulte, restaure ou gerencie tarefas concluídas arquivadas, projetos e itens na Lixeira.",
  "archive.tabTasks": "Tarefas",
  "archive.tabProjects": "Projetos",
  "archive.tabTrash": "Lixeira (30 dias)",

  "planner.title": "Planejador do Dia",
  "planner.subtitle": "Distribua suas tarefas nos horários livres respeitando compromissos, rotinas e dependências.",
  "planner.generate": "Gerar Sugestão",
  "planner.generating": "Planejando...",

  "routines.title": "Rotinas",
  "routines.subtitle": "Crie rotinas sequenciais com duração por etapa e execute no modo passo a passo.",

  "subs.title": "Gerenciador de Assinaturas",
  "subs.subtitle": "Controle assinaturas, períodos de teste e custos equivalentes mensais e anuais.",

  "shopping.title": "Listas de Compras",
  "shopping.subtitle": "Listas compartilhadas por Espaço, sugestões baseadas no seu histórico e lançamento em Finanças.",

  "trips.title": "Planejador de Viagens",
  "trips.subtitle": "Organize viagens, roteiro por dia, bagagem e integre atividades ao seu Calendário.",
};

export function translate(lang: AppLanguage, key: I18nKey): string {
  return lang === "pt-BR" ? DICT_PT[key] : DICT_EN[key];
}

export function getModuleName(lang: AppLanguage, moduleId: string, fallbackName: string): string {
  if (lang === "pt-BR") {
    return MODULE_NAMES_PT[moduleId] ?? fallbackName;
  }
  return fallbackName;
}

export function getSectionName(lang: AppLanguage, sectionKey: string, fallbackName: string): string {
  return SECTION_NAMES_I18N[lang][sectionKey] ?? fallbackName;
}
