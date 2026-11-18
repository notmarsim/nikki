import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { getModuleById } from "@/config/modules";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleIcon } from "@/components/ui/module-icon";

export function ModulePlaceholder({ moduleId }: { moduleId: string }) {
  const mod = getModuleById(moduleId);

  if (!mod) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <ModuleIcon name={mod.icon} className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{mod.name}</h1>
              <Badge variant="warning">Phase {mod.phase} — In Development</Badge>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">{mod.description}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Construction className="h-5 w-5" />
            <CardTitle>Module Scheduled for Phase {mod.phase}</CardTitle>
          </div>
          <CardDescription>
            This route is wired into Nikki&apos;s navigation, authentication, and
            module registry. Full database persistence and interactive workflows will be
            implemented in Phase {mod.phase}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Planned Capabilities
            </h4>
            <ul className="space-y-1.5 text-sm">
              {mod.plannedFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
