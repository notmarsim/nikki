export interface TourStepConfig {
  id: string;
  moduleId: string;
  route: string;
  targetSelector: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  advancedOnly?: boolean;
}

export interface TourDefinition {
  id: string;
  title: string;
  description: string;
  steps: TourStepConfig[];
}

export const INITIAL_TOUR_ID = "nikki-initial-tour-v1";

export const INITIAL_TOUR: TourDefinition = {
  id: INITIAL_TOUR_ID,
  title: "Tour Inicial do Nikki",
  description: "Conheça os principais módulos do Nikki em poucos passos.",
  steps: [
    {
      id: "step-dashboard",
      moduleId: "dashboard",
      route: "/dashboard",
      targetSelector: '[data-tour="dashboard-header"]',
      title: "1. Dashboard",
      description: "Sua central diária com resumo de tarefas, compromissos, finanças e sugestões contextuais.",
      placement: "bottom",
    },
    {
      id: "step-nav",
      moduleId: "navigation",
      route: "/dashboard",
      targetSelector: '[data-tour="sidebar-nav"]',
      title: "2. Navegação",
      description: "Acesse todos os módulos por aqui ou pressione Ctrl+K a qualquer momento para abrir a busca rápida.",
      placement: "right",
    },
    {
      id: "step-tasks",
      moduleId: "tasks",
      route: "/tasks",
      targetSelector: '[data-tour="tasks-quick-add"]',
      title: "3. Tasks",
      description: "Crie tarefas rapidamente, defina prioridades, datas com horário opcional e dependências.",
      placement: "bottom",
    },
    {
      id: "step-calendar",
      moduleId: "calendar",
      route: "/calendar",
      targetSelector: '[data-tour="nav-calendar"]',
      title: "4. Calendar",
      description: "Visualize seus compromissos, blocos de tempo e atividades de viagem em um único lugar.",
      placement: "right",
    },
    {
      id: "step-projects",
      moduleId: "projects",
      route: "/projects",
      targetSelector: '[data-tour="nav-projects"]',
      title: "5. Projects",
      description: "Agrupe tarefas, notas e marcos com cálculo automático de progresso e bloqueios.",
      placement: "right",
    },
    {
      id: "step-habits-routines",
      moduleId: "routines",
      route: "/routines",
      targetSelector: '[data-tour="nav-routines"]',
      title: "6. Habits & Routines",
      description: "Hábitos medem consistência diária; Rotinas guiam sequências cronometradas de etapas.",
      placement: "right",
    },
    {
      id: "step-notes",
      moduleId: "notes",
      route: "/notes",
      targetSelector: '[data-tour="nav-notes"]',
      title: "7. Notes",
      description: "Escreva anotações em blocos com links entre páginas, diagramas e colaboração.",
      placement: "right",
    },
    {
      id: "step-finances",
      moduleId: "finances",
      route: "/finances",
      targetSelector: '[data-tour="nav-finances"]',
      title: "8. Finances & Subscriptions",
      description: "Controle contas, orçamentos, metas e acompanhe assinaturas recorrentes sem surpresas.",
      placement: "right",
    },
    {
      id: "step-day-planner",
      moduleId: "day-planner",
      route: "/day-planner",
      targetSelector: '[data-tour="nav-day-planner"]',
      title: "9. Day Planner",
      description: "Distribua tarefas nos seus horários livres respeitando compromissos e prioridades.",
      placement: "right",
    },
    {
      id: "step-spaces",
      moduleId: "spaces",
      route: "/spaces",
      targetSelector: '[data-tour="nav-spaces"]',
      title: "10. Spaces",
      description: "Crie espaços compartilhados para colaborar em listas, viagens e projetos.",
      placement: "right",
      advancedOnly: true,
    },
    {
      id: "step-settings",
      moduleId: "settings",
      route: "/settings",
      targetSelector: '[data-tour="nav-settings"]',
      title: "11. Settings",
      description: "Personalize tema, Modo Simples/Avançado, widgets do dashboard e retenção de dados.",
      placement: "right",
    },
  ],
};

export const MODULE_TOURS: TourDefinition[] = [
  {
    id: "tour-tasks",
    title: "Guia de Tasks",
    description: "Aprenda a usar prioridades, horários opcionais e dependências.",
    steps: [
      {
        id: "tasks-create",
        moduleId: "tasks",
        route: "/tasks",
        targetSelector: '[data-tour="tasks-quick-add"]',
        title: "Criar Tarefas",
        description: "Digite o título, escolha a prioridade e defina uma data (o horário é opcional).",
        placement: "bottom",
      },
    ],
  },
  {
    id: "tour-day-planner",
    title: "Guia do Day Planner",
    description: "Veja como gerar sua agenda diária automaticamente.",
    steps: [
      {
        id: "planner-generate",
        moduleId: "day-planner",
        route: "/day-planner",
        targetSelector: '[data-tour="day-planner-generate"]',
        title: "Gerar Sugestão de Agenda",
        description: "Clique aqui para encaixar suas tarefas pendentes nos horários livres do dia.",
        placement: "bottom",
      },
    ],
  },
  {
    id: "tour-routines",
    title: "Guia de Routines",
    description: "Monte sequências cronometradas para manhã, estudo ou noite.",
    steps: [
      {
        id: "routines-create",
        moduleId: "routines",
        route: "/routines",
        targetSelector: '[data-tour="routines-create"]',
        title: "Nova Rotina",
        description: "Adicione etapas em ordem com duração em minutos e execute com timer passo a passo.",
        placement: "bottom",
      },
    ],
  },
];

export const ALL_TOURS: TourDefinition[] = [INITIAL_TOUR, ...MODULE_TOURS];
