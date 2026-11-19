# Nikki — Arquitetura e Plano (Fases 1 e 2)

## 1. Arquitetura Técnica Proposta

O **Nikki** adota uma arquitetura **monolítica modular** baseada em **Next.js (App Router)** com **TypeScript em modo strict**, **Supabase PostgreSQL**, **Supabase Storage** e **Drizzle ORM**:

- **Camada de Apresentação (Frontend):** React 19 + Next.js App Router (Server Components para carregamento inicial autenticado e Client Components para interatividade), Tailwind CSS v4 com CSS custom properties para temas (`light`, `dark`, `system`), Zustand para estado global de UI (sidebar, command palette, módulos fixados), TanStack Query para cache e mutações de dados no cliente, e React Hook Form + Zod para validação de formulários.
- **Camada de Aplicação / API (Backend):** Next.js Route Handlers (`/api/*`) organizados por domínio em `src/modules/*`, com validação Zod na entrada, respostas padronizadas (`{ data, error }`), rate limiting e logs estruturados sem exposição de credenciais.
- **Camada de Persistência:** PostgreSQL 16 + Drizzle ORM (`postgres-js`) com migrations versionadas em `src/db/migrations`, transações explícitas (`db.transaction`) para operações compostas e isolamento estrito por `userId` e `workspaceId`.
- **Infraestrutura:** Docker (`Dockerfile` multi-stage standalone + `docker-compose.yml` com PostgreSQL + App), configuração por variáveis de ambiente validadas via Zod (`src/lib/env.ts`) e suíte de testes com Vitest + Testing Library.

---

## 2. Estrutura Completa de Diretórios

```text
planium/
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── docs/
│   └── ARCHITECTURE.md
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   ├── (app)/
    │   │   ├── layout.tsx               # Shell protegido com verificação de sessão
    │   │   ├── dashboard/page.tsx
    │   │   ├── settings/page.tsx
    │   │   ├── inbox/page.tsx
    │   │   ├── notes/page.tsx
    │   │   ├── tasks/page.tsx
    │   │   ├── projects/page.tsx
    │   │   ├── calendar/page.tsx
    │   │   ├── learning/page.tsx
    │   │   ├── habits/page.tsx
    │   │   ├── focus/page.tsx
    │   │   ├── knowledge-graph/page.tsx
    │   │   ├── bookmarks/page.tsx
    │   │   ├── developer-hub/page.tsx
    │   │   ├── finances/page.tsx
    │   │   └── analytics/page.tsx
    │   ├── api/
    │   │   ├── health/route.ts
    │   │   ├── settings/route.ts
    │   │   └── auth/
    │   │       ├── register/route.ts
    │   │       ├── login/route.ts
    │   │       ├── logout/route.ts
    │   │       └── me/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── layout/                      # AppShell, Sidebar, Topbar, CommandPalette
    │   ├── providers/                   # ThemeProvider, QueryProvider
    │   ├── settings/                    # SettingsForm
    │   ├── shared/                      # ModulePlaceholder
    │   └── ui/                          # Button, Card, Badge, Input, ModuleIcon
    ├── config/
    │   └── modules.ts                   # Registro único dos 15 módulos e fases
    ├── db/
    │   ├── index.ts                     # Pool PostgreSQL + instância Drizzle
    │   ├── migrations/                  # Migrations SQL geradas pelo drizzle-kit
    │   └── schema/
    │       ├── enums.ts
    │       ├── users.ts                 # users, sessions, user_settings
    │       ├── workspaces.ts            # workspaces
    │       ├── relations.ts             # tags, entity_tags, entity_relations, activity_logs
    │       ├── core-phase2.ts           # projects, notes, tasks, inbox_items
    │       └── index.ts
    ├── lib/
    │   ├── api-response.ts
    │   ├── env.ts
    │   ├── logger.ts
    │   ├── rate-limit.ts
    │   └── utils.ts
    ├── modules/
    │   ├── auth/                        # password.ts, session.ts, schemas.ts
    │   └── users/                       # service.ts (bootstrap de usuário + workspace)
    ├── stores/
    │   └── ui-store.ts
    └── test/
        └── setup.ts
```

---

## 3. Modelagem Inicial do Banco de Dados

As tabelas da Fase 1 e do núcleo da Fase 2 estão modeladas em `src/db/schema/`:

- **Fundação (Fase 1):**
  - `users`: `id (uuid PK)`, `email (unique)`, `name`, `password_hash`, `avatar_url`, `timezone`, `theme`, `created_at`, `updated_at`.
  - `sessions`: `id (uuid PK)`, `user_id (FK -> users)`, `token_hash (unique)`, `user_agent`, `ip_address`, `expires_at`, `created_at`.
  - `user_settings`: `id (uuid PK)`, `user_id (FK -> users, unique)`, `sidebar_collapsed`, `default_workspace_id`, `shortcuts (jsonb)`, `dashboard_layout (jsonb)`, `updated_at`.
  - `workspaces`: `id (uuid PK)`, `owner_id (FK -> users)`, `name`, `slug`, `icon`, `description`, `created_at`, `updated_at`.
- **Integração Transversal:**
  - `tags` & `entity_tags`: sistema unificado de tags polimórficas por `(entity_type, entity_id)`.
  - `entity_relations`: grafo explícito `(source_type, source_id, target_type, target_id, relation_type, metadata)` para links bidirecionais e dependências.
  - `activity_logs`: trilha de auditoria e histórico por workspace e entidade.
- **Núcleo da Fase 2:**
  - `projects`: `id`, `user_id`, `workspace_id`, `name`, `description`, `icon`, `color`, `status`, `priority`, `start_date`, `target_date`, `progress`.
  - `notes`: `id`, `user_id`, `workspace_id`, `parent_id (self-FK)`, `project_id (FK -> projects)`, `title`, `icon`, `content_json (jsonb)`, `content_text`, `is_favorite`, `sort_order`.
  - `tasks`: `id`, `user_id`, `workspace_id`, `project_id (FK -> projects)`, `note_id (FK -> notes)`, `parent_task_id (self-FK)`, `title`, `description`, `status`, `priority`, `due_at`, `start_at`, `estimated_minutes`, `actual_minutes`, `recurrence_rule`, `completed_at`.
  - `inbox_items`: `id`, `user_id`, `workspace_id`, `type`, `title`, `content`, `url`, `status`, `converted_to_type`, `converted_to_id`.

---

## 4. Entidades e Relacionamentos Principais

- **User 1:N Workspaces** e **User 1:1 UserSettings** (criados atomicamente no cadastro).
- **User 1:N Sessions** (permite revogação individual e expiração no banco).
- **Workspace 1:N Projects / Notes / Tasks / InboxItems / Tags**.
- **Project 1:N Notes** e **Project 1:N Tasks** (com `ON DELETE SET NULL` para preservar notas/tarefas se um projeto for removido).
- **Note 1:N Notes** (hierarquia de subpáginas via `parent_id`) e **Note 1:N Tasks** (tarefas originadas de blocos de anotação).
- **Task 1:N Tasks** (subtarefas aninhadas via `parent_task_id` com `ON DELETE CASCADE`).
- **EntityRelations (N:N polimórfico por UUIDs estáveis)** conectando qualquer par `(source_type, source_id) -> (target_type, target_id)` sem depender de títulos mutáveis.

---

## 5. Fluxo de Autenticação

1. **Cadastro (`POST /api/auth/register`):** valida dados com Zod (`registerSchema`), aplica rate limit por IP, verifica unicidade de e-mail, gera hash de senha com `crypto.scrypt` + salt aleatório de 16 bytes, executa `db.transaction` criando `user` + workspace `"Personal"` + `user_settings`, cria registro em `sessions` com hash SHA-256 de um token opaco de 32 bytes e define cookie `HttpOnly`, `SameSite=Lax`, `Secure` (em produção).
2. **Login (`POST /api/auth/login`):** aplica rate limit, verifica senha com `crypto.timingSafeEqual`, gera nova sessão opaca e define o cookie `pos_session`.
3. **Verificação (`getCurrentSession()`):** executada no servidor (Server Components e Route Handlers), calcula SHA-256 do cookie, consulta `sessions JOIN users` garantindo `expires_at > now()`.
4. **Proteção de Rotas e Anti-IDOR:** o layout `src/app/(app)/layout.tsx` redireciona usuários não autenticados para `/login`. Toda consulta/mutação nas APIs exige sessão válida e filtra por `userId = session.user.id`.
5. **Logout (`POST /api/auth/logout`):** remove o registro da tabela `sessions` e limpa o cookie.

---

## 6. Estratégia de Integração entre Módulos

- **Identificadores Estáveis:** toda relação usa UUIDs imutáveis (`id`), nunca títulos de páginas ou nomes de tarefas.
- **Contratos Explícitos:** `entity_relations` e `entity_tags` fornecem um barramento relacional único para links `[[Nota]]`, backlinks, dependências e conversão de `inbox_items` para `notes`/`tasks`.
- **Desacoplamento:** cada domínio reside em `src/modules/<domínio>` sem dependências circulares; regras transversais (ex.: recalcular `projects.progress` ao concluir uma `task`) serão disparadas via serviços de domínio / eventos internos bem definidos na Fase 2.

---

## 7. Organização dos Componentes React

- `src/components/ui/`: primitivos reutilizáveis e agnósticos de domínio (`Button`, `Card`, `Badge`, `Input`, `ModuleIcon`).
- `src/components/providers/`: contextos globais (`ThemeProvider`, `QueryProvider`).
- `src/components/layout/`: estrutura principal (`AppShell`, `Sidebar` recolhível com seções e favoritos, `Topbar`, `CommandPalette` via `Ctrl+K`).
- `src/components/shared/`: componentes transversais (`ModulePlaceholder` para indicar de forma transparente módulos em desenvolvimento).
- `src/components/<domínio>/`: componentes específicos de cada módulo (ex.: `settings/settings-form.tsx`).

---

## 8. Estratégia de Persistência do Editor (Fase 2)

- O editor de blocos armazenará uma árvore JSON estruturada em `notes.content_json` (`NoteBlockDocument`: `{ version: 1, type: "doc", content: NoteBlockNode[] }`), preservando `id` de bloco, `type`, `attrs`, `marks` e hierarquia sem depender de HTML bruto.
- Simultaneamente, será extraído texto plano para `notes.content_text` para indexação `tsvector`/GIN no PostgreSQL (busca global e dentro da página).
- Links bidirecionais `[[...]]` serão resolvidos por ID e sincronizados na tabela `entity_relations` (`relation_type = 'references'`).

---

## 9. Plano de Implementação Incremental

- **Fase 1 (Entregue agora):** configuração Next.js/TS strict, Drizzle + PostgreSQL, migrations, autenticação por sessão opaca, layout responsivo com sidebar recolhível, temas (`light`/`dark`/`system`), Command Palette (`Ctrl+K`), Dashboard com contagens reais, Settings persistido, rotas dos 15 módulos com estado explícito, Docker e testes iniciais.
- **Fase 2 (Próxima):** Notes (editor em blocos + `[[links]]`), Tasks (listas, Kanban, subtarefas, recorrência), Projects (espaços + cálculo automático de progresso), Universal Inbox (captura global + conversão) e busca básica.
- **Fase 3:** Calendar (time blocking), Learning (cursos + flashcards FSRS), Habits (streaks + heatmap) e Focus (Pomodoro baseado em timestamps confiáveis).
- **Fase 4:** Knowledge Graph, Bookmarks (com proteção SSRF) e Developer Hub.
- **Fase 5:** Automações (`Trigger -> Conditions -> Actions`), Analytics & Revisão Semanal, Finances (centavos inteiros), Dashboard customizável e PWA/offline.

---

## 10. Critérios Objetivos de Conclusão da Fase 1

1. `npm run typecheck` (`tsc --noEmit`) passa com zero erros em modo `strict`.
2. `npm run lint` passa sem erros.
3. `npm run test` (Vitest) executa e aprova todos os testes unitários de fundação (hash de senha, schemas Zod, rate limiter, registro de módulos).
4. `npm run build` (`next build`) compila todas as rotas e gera o bundle standalone com sucesso.
5. `npx drizzle-kit generate` gera a migration SQL inicial versionada a partir do schema em `src/db/schema/`.
6. Todos os 15 módulos possuem rotas acessíveis na Sidebar e no Command Palette, com páginas não implementadas exibindo claramente seu estado de desenvolvimento.


---

## 11. Entregas da Fase 2 (Core Productivity System)

- **Renomeação:** Identidade visual, metadata, manifest (`/manifest.webmanifest`), rotas, documentação e UI atualizados para **Nikki**.
- **Migrations & RLS (`0001_amusing_hex.sql`, `0002_rls_and_fts.sql`):**
  - Novas tabelas: `milestones`, `note_links`, `note_attachments`, `task_tags`, `task_recurrence_rules`.
  - Índices GIN Full-Text Search em `notes`, `tasks` e `projects`.
  - Row Level Security (`ENABLE ROW LEVEL SECURITY`) + policies de ownership em todas as tabelas pessoais via `public.nikki_current_user_id()` e `withUserRls()` (`src/db/rls.ts`).
- **Módulos Implementados:**
  - **Notes (`/notes`):** Editor em blocos Tiptap (JSONB canônico + extração `content_text`), Slash commands (`/`), `[[Page Links]]` por ID + backlinks, 6 templates, hierarquia multi-nível com proteção anti-ciclo, autosave com `expectedVersion` (409 em conflito), KaTeX, Mermaid, upload privado via Supabase Storage (`/api/notes/upload`, `/api/notes/attachments/[id]`) e conversão de seleção/linha em Tarefa.
  - **Tasks (`/tasks`):** Visões Today, Upcoming, All Tasks, Board (Kanban drag-and-drop via `@dnd-kit/core`) e Completed; subtarefas com proteção anti-ciclo, tags, recorrência (diária/semanal/mensal idempotente) e painel Task Detail.
  - **Projects (`/projects`):** Overview, Tasks, Notes, Milestones, Settings e cálculo automático de progresso (`completed_tasks / total_active_tasks * 100`, ignorando canceladas e subtarefas).
  - **Universal Inbox (`/inbox` + `Ctrl+Shift+I`):** Captura rápida global e conversão transacional/idempotente para Notes ou Tasks (com projeto opcional).
  - **Global Search (`Ctrl+K`):** Busca PostgreSQL FTS integrada ao Command Palette.
  - **Dashboard (`/dashboard`):** Widgets reais (Overview, Quick Capture, Tasks Today, Active Projects, Recent Notes, Recent Activity) com invalidação TanStack Query.


---

## Fase 3 — Planning, Learning & Productivity

A Fase 3 expande o Nikki com cinco módulos integrados, mantendo a arquitetura monolítica modular com persistência real em PostgreSQL (Supabase) e Row Level Security (RLS) em todas as novas tabelas:

1. **Calendar (`/calendar`)**
   - Tabelas: `calendar_events`, `calendar_event_exceptions`, `scheduled_time_blocks`.
   - Recorrência canônica RFC 5545 RRULE via biblioteca `rrule`, com expansão sob demanda no intervalo consultado e suporte a exceções (`single` vs. `series` e `cancelled` / `rescheduled`).
   - Time Blocking integrado a Tasks (`/api/calendar/schedule-task`) preservando `due_at` separado dos blocos de execução.
   - Detecção de conflitos por sobreposição temporal e suporte explícito a fusos horários e eventos de dia inteiro.

2. **Learning Hub (`/learning`)**
   - Tabelas: `learning_paths`, `courses`, `learning_path_courses`, `course_modules`, `lessons`, `learning_resource_links`.
   - Hierarquia completa: Trilha -> Curso -> Módulo -> Aula.
   - Progresso calculado dinamicamente (`completed_lessons / total_lessons * 100`) e atualizado em transação ao marcar aulas como concluídas.
   - Vínculos explícitos com Notes, Tasks e sessões de Focus.

3. **Flashcards (`/flashcards`)**
   - Tabelas: `flashcard_decks`, `flashcard_notes`, `flashcards`, `flashcard_reviews`.
   - Algoritmo de repetição espaçada **FSRS** via `ts-fsrs`, suportando cards `basic`, `basic_reversed` e `cloze`.
   - Revisões atômicas e idempotentes (`reviewRequestId` único) com gravação de histórico em `flashcard_reviews`.
   - Criação direta de flashcards a partir de trechos selecionados no editor de Notes (`sourceNoteId`).

4. **Focus (`/focus`)**
   - Tabelas: `focus_sessions`, `focus_session_intervals`, `focus_preferences`.
   - Modos Pomodoro e Stopwatch com cálculo server-side baseado em timestamps reais (`focus_session_intervals`), garantindo recuperação pós-reload.
   - Índice único parcial (`focus_sessions_one_active_per_user_uidx`) impedindo múltiplas sessões ativas simultâneas por usuário.
   - Vínculo opcional com Tasks, Projects e Courses.

5. **Habits (`/habits`)**
   - Tabelas: `habits`, `habit_entries`, `habit_activity_links`.
   - Suporte a hábitos booleanos e quantitativos com frequências `daily`, `specific_days`, `weekly_count` e `monthly_count`.
   - Cálculo consistente de streaks (`currentStreak`, `bestStreak`), consistência e heatmap de 90 dias.
   - Integração com Focus, Learning e Flashcards via `habit_activity_links`.

6. **Integração Global**
   - **Global Search** (`/api/search`) indexando também `course`, `event`, `deck` e `habit`.
   - **Command Palette** (`Ctrl+K`) com ações rápidas da Fase 3 e ícones dedicados.
   - **Dashboard** (`/dashboard`) exibindo eventos próximos, sessão de foco ativa, flashcards pendentes, tempo de estudo hoje e hábitos do dia.


---

## Fase 4 — Knowledge, Library & Developer Hub

A Fase 4 transforma o Nikki em uma plataforma integrada de conhecimento técnico, biblioteca digital e recuperação avançada de informações, com persistência em PostgreSQL (Supabase) e RLS em todas as novas tabelas (`0005_phase4_modules.sql`):

1. **Knowledge Graph (`/knowledge-graph` e Local Graph em `/notes`)**
   - Projeção em tempo real das relações reais existentes em `note_links`, `entity_relations`, `learning_resource_links`, `notes.project_id`, `developer_snippets.project_id`/`source_note_id` e `tasks.project_id`.
   - Grafo global com simulação de forças, zoom/pan, drag-and-drop de nós, menu de contexto, legenda acessível, filtros por categoria/tag/favoritos e painel de detalhes com conexões de entrada/saída.
   - Grafo local nas páginas de Notes (`/api/graph/local`) com BFS delimitado (Level 1, 2 e 3) e notas relacionadas por tags/projeto.
   - Preferências de layout e posições fixadas persistidas em `graph_preferences` e `graph_node_positions`.

2. **Bookmarks & Digital Library (`/bookmarks`)**
   - Tabelas `bookmarks` e `bookmark_collections` (hierarquia com detecção de ciclo), reutilizando `tags` e `entity_tags`.
   - Extração server-side de metadados (`Open Graph`, `Twitter Cards`, `<title>`, favicon) com proteção SSRF em `src/modules/bookmarks/ssrf.ts`: bloqueio de protocolos não HTTP(S), credenciais em URL, endereços privados/loopback/link-local/CGNAT/metadata (`169.254.169.254`), validação pós-DNS, revalidação de redirecionamentos (máx. 3), timeout de 5s, limite de 1MB e rate limiting.
   - Modos Grid/List, Read Later, Favorites, importação Netscape HTML e exportação HTML/JSON, além de conversão direta de itens da Universal Inbox (`targetType: "bookmark"`).

3. **Developer Hub (`/developer-hub`)**
   - **Snippets Manager** (`developer_snippets`): syntax highlighting com `lowlight`, numeração de linhas, cópia rápida, tags, vínculo com projetos e criação direta a partir de blocos de código no editor de Notes.
   - **Commands Manager** (`developer_commands`): biblioteca de comandos CLI com placeholders `{param}` interpolados apenas como texto para cópia segura (sem execução).
   - **Cheatsheets & Documentation Hub**: cheatsheets e documentação interna reutilizando `notes` (`doc_kind` = `'cheatsheet' | 'documentation'`) no editor Tiptap, e referências externas em `developer_references`.
   - **GitHub Integration (opcional, somente leitura)**: conexão via PAT criptografado com AES-256-GCM (`github_connections`), cache em memória com TTL de 5 minutos, listagem de repositórios, issues/PRs/releases/commits sob demanda e vinculação com Projetos (`project_repositories`).

4. **Advanced Global Search (`/search` e Command Palette)**
   - Busca unificada em 12 tipos de entidade (`note`, `task`, `project`, `course`, `lesson`, `event`, `deck`, `habit`, `bookmark`, `snippet`, `command`, `reference`) usando PostgreSQL FTS (`to_tsvector` + `plainto_tsquery` com índices GIN) e busca aproximada via `pg_trgm` (`similarity`).
   - Estratégia de relevância: correspondência exata de título (+2.0) > prefixo (+0.8) > substring (+0.3) somados ao score FTS/trigram, com paginação e filtros por tipo, tag, projeto, coleção e período.


---

## Fase 5 — Personal Finances, Advanced Analytics & Comprehensive Settings

A Fase 5 completa a plataforma Nikki com finanças pessoais em precisão de centavos inteiros, analytics multi-módulo e central de configurações extensível (`0006_phase5_modules.sql`):

1. **Personal Finances (`/finances`)**
   - Armazenamento monetário em centavos inteiros (`bigint`, escala explícita de 2 casas decimais) sem ponto flutuante binário (`src/modules/finances/money.ts`).
   - **Accounts & Transfers:** saldos derivados de `initial_balance_cents` + transações confirmadas; transferências atômicas entre contas sem contabilização como receita/despesa.
   - **Credit Cards, Installments & Statements:** parcelamentos com distribuição exata de resto em centavos, atribuição automática a faturas considerando dia de fechamento e meses curtos, e pagamento de fatura (`card_payment`) sem dupla contabilização de despesa.
   - **Budgets, Recurring Rules & Goals:** consumo por categoria/split, geração idempotente de recorrências (`uniqueIndex(recurring_rule_id, recurrence_occurrence_key)`), metas com contribuições/retiradas atômicas, importação CSV com deduplicação e exportação CSV protegida contra formula injection.

2. **Advanced Analytics (`/analytics`)**
   - Camada compartilhada de métricas em `src/modules/analytics/service.ts` com comparação equivalente contra período anterior, retenção observada real de FSRS, consistência de hábitos por frequência, projetos inativos e integração opcional com Finances.
   - **Custom Report Builder** (`analytics_saved_reports`) com catálogo seguro (allowlist de módulos/métricas/agrupamentos) e exportação CSV.

3. **Settings & Personalization (`/settings`)**
   - **Preference Registry** versionado em `src/modules/settings/registry.ts` persistido em `user_settings.preferences` (JSONB) + perfil (`users.bio`, `timezone`, `theme`).
   - Categorias pesquisáveis: General & Profile, Appearance & Accessibility, Productivity & Modules, Navigation & Shortcuts (com ocultação de módulos da sidebar sem perda de dados), Finances & Privacy (`hideFinancialValues`), Notifications e Full JSON Backup.


---

## Fase 6 — Nikki 2.0: Collaboration, Personal Life, Native Ecosystem & Reliability

A Fase 6 expande o Nikki para suportar espaços compartilhados, colaboração em notas via CRDT, organização pessoal avançada, extensões nativas iOS e observabilidade operacional (`0008_phase6_modules.sql`):

1. **Nikki Spaces (`/spaces`) & RBAC**
   - `workspace_members` (`owner | admin | editor | viewer`) e `workspace_invitations` com tokens hashed em SHA-256 e uso único.
   - Switcher na Sidebar (`/api/spaces/switch`) e movimentação de recursos preservando privacidade padrão de módulos pessoais.

2. **Edição Colaborativa em Notas (`yjs` CRDT)**
   - Persistência de updates CRDT (`note_collab_states`) e checkpoints (`note_collab_snapshots`) em `/api/notes/[id]/collab`, bloqueando alterações para membros `viewer`.

3. **Organização Pessoal & Colaborativa**
   - **Goals & Life Areas (`/goals`):** Áreas da vida, horizontes e cálculo de progresso manual ou vinculado a `tasks`.
   - **Nikki Journal (`/journal`):** Diário estritamente privado por padrão com templates de reflexão/gratidão e humor.
   - **Nikki Home (`/home`):** Listas de compras, despensa com alertas de estoque mínimo, receitas e planejamento de refeições.
   - **Document Vault (`/vault`):** Registro privado de documentos com validação de MIME, limite de 20 MB e datas de expiração.
   - **Focus Rooms (`/focus-rooms`):** Salas compartilhadas com código de convite, modos `synchronized` e `independent` e privacidade de atividade.
   - **Nikki Feed (`/feed`):** Leitor RSS/Atom com proteção SSRF, bloqueio de XXE (`<!DOCTYPE`/`<!ENTITY`), sanitização XSS e salvamento em Bookmarks.
   - **Nikki Templates (`/templates`):** Instalação de pacotes multi-módulo com novos IDs isolados no workspace ativo.

4. **Ecossistema iOS & Confiabilidade**
   - Endpoint `/api/ios/widget-snapshot` + referências Swift (`ios-extensions/NikkiWidget.swift`, `NikkiAppIntents.swift`, `NikkiShareExtension.swift`) documentadas em `docs/IOS_NATIVE_ECOSYSTEM.md`.
   - **Nikki Diagnostics** (`Settings -> Help & Diagnostics` + `/api/diagnostics`) com remoção de chaves sensíveis e **Nikki Ops** (`/ops` + `/api/ops`) restrito a administradores (`users.isAdmin === true`).

5. **Arquivamento Automático Semanal, Histórico, Lixeira e Retenção (`0009_archive_retention.sql`)**
   - **Ciclo de Vida (`tasks` e `projects`):** `completed_at`, `archived_at`, `archive_after` (calculado em UTC conforme `users.timezone` e `preferences.weekStartsOn`) e `deleted_at`.
   - **Rotina Idempotente:** função PostgreSQL `public.nikki_run_archive_and_retention_job()` + endpoint `/api/cron/archive` agendado por `vercel.json` (e `pg_cron` quando habilitado no Supabase), arquivando tarefas concluídas após o fim da semana, purgando itens na Lixeira após 30 dias e aplicando retenção histórica apenas por opt-in (`1`, `2` ou `5` anos; padrão `"forever"`).
   - **Página `/archive` & Exportação (`/api/archive/export`):** filtros e paginação no banco (25 itens/página), restauração em lote, Lixeira com contagem regressiva de 30 dias e preservação de métricas históricas no **Analytics**.
