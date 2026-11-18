import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { APP_MODULES } from "@/config/modules";
import { db } from "@/db";
import { inboxItems, notes, projects, tasks } from "@/db/schema";
import { getCurrentSession } from "@/modules/auth/session";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ModuleIcon } from "@/components/ui/module-icon";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const userId = session.user.id;

  const [notesCountRes, tasksCountRes, projectsCountRes, inboxCountRes] =
    await Promise.all([
      db.select({ value: count() }).from(notes).where(eq(notes.userId, userId)),
      db.select({ value: count() }).from(tasks).where(eq(tasks.userId, userId)),
      db.select({ value: count() }).from(projects).where(eq(projects.userId, userId)),
      db.select({ value: count() }).from(inboxItems).where(eq(inboxItems.userId, userId)),
    ]);

  const stats = [
    { label: "Notes", value: notesCountRes[0]?.value ?? 0, href: "/notes", icon: "FileText" },
    { label: "Tasks", value: tasksCountRes[0]?.value ?? 0, href: "/tasks", icon: "CheckSquare" },
    { label: "Projects", value: projectsCountRes[0]?.value ?? 0, href: "/projects", icon: "FolderKanban" },
    { label: "Inbox Items", value: inboxCountRes[0]?.value ?? 0, href: "/inbox", icon: "Inbox" },
  ];

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: session.user.timezone || "UTC",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Greeting Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session.user.name}
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">{todayFormatted}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">Phase 1 Foundation Active</Badge>
          <Badge variant="outline">Timezone: {session.user.timezone}</Badge>
        </div>
      </div>

      {/* Real Database Counts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:border-[var(--accent)]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-[var(--muted-foreground)]">
                  {stat.label}
                </CardTitle>
                <ModuleIcon
                  name={stat.icon}
                  className="h-4 w-4 text-[var(--muted-foreground)]"
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Stored in PostgreSQL
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Platform Module Status */}
      <Card>
        <CardHeader>
          <CardTitle>Personal OS — Module Rollout</CardTitle>
          <CardDescription>
            Incremental delivery status across all 15 modules. Use{" "}
            <kbd className="rounded border border-[var(--border)] px-1 py-0.5 text-xs font-mono">
              Ctrl+K
            </kbd>{" "}
            to jump to any module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {APP_MODULES.map((mod) => (
              <Link
                key={mod.id}
                href={mod.href}
                className="group flex items-start justify-between rounded-lg border border-[var(--border)] p-3 transition-colors hover:bg-[var(--surface-muted)]"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <ModuleIcon
                    name={mod.icon}
                    className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {mod.name}
                      </span>
                      {mod.status === "active" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
                      {mod.description}
                    </p>
                  </div>
                </div>
                <ArrowRight className="ml-2 mt-0.5 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
