import type { AppLanguage } from "@/lib/i18n";

export interface TourStepConfig {
  id: string;
  moduleId: string;
  route: string;
  targetSelector: string;
  title: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  placement?: "top" | "bottom" | "left" | "right";
  advancedOnly?: boolean;
}

export interface TourDefinition {
  id: string;
  title: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  steps: TourStepConfig[];
}

export const INITIAL_TOUR_ID = "nikki-initial-tour-v1";

export const INITIAL_TOUR: TourDefinition = {
  id: INITIAL_TOUR_ID,
  title: {
    "en-US": "Nikki Quick Tour",
    "pt-BR": "Tour Inicial do Nikki",
  },
  description: {
    "en-US": "Explore Nikki's core modules in just a few steps.",
    "pt-BR": "Conheça os principais módulos do Nikki em poucos passos.",
  },
  steps: [
    {
      id: "step-dashboard",
      moduleId: "dashboard",
      route: "/dashboard",
      targetSelector: '[data-tour="dashboard-header"]',
      title: { "en-US": "Dashboard", "pt-BR": "Painel Inicial" },
      description: {
        "en-US": "Your daily hub with task summaries, upcoming events, finances, and contextual suggestions.",
        "pt-BR": "Sua central diária com resumo de tarefas, compromissos, finanças e sugestões contextuais.",
      },
      placement: "bottom",
    },
    {
      id: "step-nav",
      moduleId: "navigation",
      route: "/dashboard",
      targetSelector: '[data-tour="sidebar-nav"]',
      title: { "en-US": "Navigation", "pt-BR": "Navegação" },
      description: {
        "en-US": "Access all modules from the sidebar, or press Ctrl+K anytime to open quick search.",
        "pt-BR": "Acesse todos os módulos por aqui ou pressione Ctrl+K a qualquer momento para abrir a busca rápida.",
      },
      placement: "right",
    },
    {
      id: "step-tasks",
      moduleId: "tasks",
      route: "/dashboard",
      targetSelector: '[data-tour="nav-tasks"]',
      title: { "en-US": "Tasks", "pt-BR": "Tarefas" },
      description: {
        "en-US": "Organize your tasks, set priorities, optional due times, and task dependencies.",
        "pt-BR": "Organize suas tarefas, defina prioridades, datas com horário opcional e dependências.",
      },
      placement: "right",
    },
    {
      id: "step-calendar",
      moduleId: "calendar",
      route: "/calendar",
      targetSelector: '[data-tour="nav-calendar"]',
      title: { "en-US": "Calendar", "pt-BR": "Calendário" },
      description: {
        "en-US": "View events, time blocks, and trip activities in one unified calendar.",
        "pt-BR": "Visualize seus compromissos, blocos de tempo e atividades de viagem em um único lugar.",
      },
      placement: "right",
    },
    {
      id: "step-projects",
      moduleId: "projects",
      route: "/projects",
      targetSelector: '[data-tour="nav-projects"]',
      title: { "en-US": "Projects", "pt-BR": "Projetos" },
      description: {
        "en-US": "Group tasks, notes, and milestones with automatic progress tracking.",
        "pt-BR": "Agrupe tarefas, notas e marcos com cálculo automático de progresso e bloqueios.",
      },
      placement: "right",
    },
    {
      id: "step-habits-routines",
      moduleId: "routines",
      route: "/routines",
      targetSelector: '[data-tour="nav-routines"]',
      title: { "en-US": "Habits & Routines", "pt-BR": "Hábitos e Rotinas" },
      description: {
        "en-US": "Habits track daily consistency; Routines guide you through timed step-by-step sequences.",
        "pt-BR": "Hábitos medem consistência diária; Rotinas guiam sequências cronometradas de etapas.",
      },
      placement: "right",
    },
    {
      id: "step-notes",
      moduleId: "notes",
      route: "/notes",
      targetSelector: '[data-tour="nav-notes"]',
      title: { "en-US": "Notes", "pt-BR": "Notas" },
      description: {
        "en-US": "Write block-based notes with page links, diagrams, and collaboration.",
        "pt-BR": "Escreva anotações em blocos com links entre páginas, diagramas e colaboração.",
      },
      placement: "right",
    },
    {
      id: "step-finances",
      moduleId: "finances",
      route: "/finances",
      targetSelector: '[data-tour="nav-finances"]',
      title: { "en-US": "Finances & Subscriptions", "pt-BR": "Finanças e Assinaturas" },
      description: {
        "en-US": "Manage accounts, budgets, goals, and track recurring subscriptions.",
        "pt-BR": "Controle contas, orçamentos, metas e acompanhe assinaturas recorrentes sem surpresas.",
      },
      placement: "right",
    },
    {
      id: "step-day-planner",
      moduleId: "day-planner",
      route: "/day-planner",
      targetSelector: '[data-tour="nav-day-planner"]',
      title: { "en-US": "Day Planner", "pt-BR": "Planejador do Dia" },
      description: {
        "en-US": "Automatically schedule pending tasks into free slots around your events and routines.",
        "pt-BR": "Distribua tarefas nos seus horários livres respeitando compromissos e prioridades.",
      },
      placement: "right",
    },
    {
      id: "step-spaces",
      moduleId: "spaces",
      route: "/spaces",
      targetSelector: '[data-tour="nav-spaces"]',
      title: { "en-US": "Spaces", "pt-BR": "Espaços" },
      description: {
        "en-US": "Create shared spaces to collaborate on shopping lists, trips, and projects.",
        "pt-BR": "Crie espaços compartilhados para colaborar em listas, viagens e projetos.",
      },
      placement: "right",
      advancedOnly: true,
    },
    {
      id: "step-settings",
      moduleId: "settings",
      route: "/settings",
      targetSelector: '[data-tour="nav-settings"]',
      title: { "en-US": "Settings", "pt-BR": "Configurações" },
      description: {
        "en-US": "Customize language, theme, Simple/Advanced Mode, dashboard widgets, and data retention.",
        "pt-BR": "Personalize idioma, tema, Modo Simples/Avançado, widgets do painel e retenção de dados.",
      },
      placement: "right",
    },
  ],
};

export const MODULE_TOURS: TourDefinition[] = [
  {
    id: "tour-tasks",
    title: { "en-US": "Tasks Guide", "pt-BR": "Guia de Tarefas" },
    description: {
      "en-US": "Learn how to use priorities, optional due times, and dependencies.",
      "pt-BR": "Aprenda a usar prioridades, horários opcionais e dependências.",
    },
    steps: [
      {
        id: "tasks-create",
        moduleId: "tasks",
        route: "/tasks",
        targetSelector: '[data-tour="tasks-quick-add"]',
        title: { "en-US": "Create Tasks", "pt-BR": "Criar Tarefas" },
        description: {
          "en-US": "Enter a title, pick a priority, and set a due date (time is optional).",
          "pt-BR": "Digite o título, escolha a prioridade e defina uma data (o horário é opcional).",
        },
        placement: "bottom",
      },
    ],
  },
  {
    id: "tour-day-planner",
    title: { "en-US": "Day Planner Guide", "pt-BR": "Guia do Planejador do Dia" },
    description: {
      "en-US": "See how to generate your daily schedule automatically.",
      "pt-BR": "Veja como gerar sua agenda diária automaticamente.",
    },
    steps: [
      {
        id: "planner-generate",
        moduleId: "day-planner",
        route: "/day-planner",
        targetSelector: '[data-tour="day-planner-generate"]',
        title: { "en-US": "Generate Schedule", "pt-BR": "Gerar Sugestão de Agenda" },
        description: {
          "en-US": "Click here to fit your pending tasks into today's available time slots.",
          "pt-BR": "Clique aqui para encaixar suas tarefas pendentes nos horários livres do dia.",
        },
        placement: "bottom",
      },
    ],
  },
  {
    id: "tour-routines",
    title: { "en-US": "Routines Guide", "pt-BR": "Guia de Rotinas" },
    description: {
      "en-US": "Build timed step-by-step sequences for morning, study, or evening.",
      "pt-BR": "Monte sequências cronometradas para manhã, estudo ou noite.",
    },
    steps: [
      {
        id: "routines-create",
        moduleId: "routines",
        route: "/routines",
        targetSelector: '[data-tour="routines-create"]',
        title: { "en-US": "New Routine", "pt-BR": "Nova Rotina" },
        description: {
          "en-US": "Add ordered steps with minute durations and run them step by step.",
          "pt-BR": "Adicione etapas em ordem com duração em minutos e execute passo a passo.",
        },
        placement: "bottom",
      },
    ],
  },
];

export const ALL_TOURS: TourDefinition[] = [INITIAL_TOUR, ...MODULE_TOURS];
