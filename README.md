# Nikki

Modular personal productivity, knowledge, and organization platform built with Next.js (App Router), TypeScript (strict), Tailwind CSS, Drizzle ORM, and Supabase PostgreSQL.

## Phase 1 Foundation

- **Architecture & Roadmap:** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Authentication:** Opaque session tokens hashed with SHA-256 in PostgreSQL (`sessions` table) + `scrypt` password hashing + `HttpOnly` cookies.
- **UI Shell:** Collapsible responsive sidebar, theme system (`light` / `dark` / `system`), Command Palette (`Ctrl + K`), Dashboard with live PostgreSQL counts, Settings page, and explicit development-status placeholders for Phases 2–5.
- **Database:** Drizzle ORM schema (`src/db/schema/`) covering Phase 1 (`users`, `sessions`, `user_settings`, `workspaces`, `tags`, `entity_tags`, `entity_relations`, `activity_logs`) and core Phase 2 entities (`projects`, `notes`, `tasks`, `inbox_items`).

## Getting Started

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL (via Docker Compose):
   ```bash
   docker compose up -d postgres
   ```

3. Run migrations:
   ```bash
   npm run db:migrate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Verification Commands

- `npm run typecheck` — TypeScript strict check
- `npm run lint` — ESLint
- `npm run test` — Vitest unit tests
- `npm run build` — Production Next.js build
