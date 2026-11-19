"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, ShieldAlert } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

interface OpsData {
  totalUsers: number;
  errors: Array<{ id: string; source: string; severity: string; message: string; createdAt: string }>;
  diagnosticReports: Array<{
    id: string;
    platform: string;
    appVersion: string;
    summary?: Record<string, unknown>;
    createdAt: string;
  }>;
  auditEvents: Array<{ id: string; action: string; targetType: string | null; createdAt: string }>;
}

export function OpsWorkspace() {
  const { tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [data, setData] = useState<OpsData | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops");
      if (!res.ok) {
        setHasError(true);
        return;
      }
      const json = (await res.json()) as { data?: OpsData };
      if (json.data) setData(json.data);
    })();
  }, []);

  if (hasError) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400">
          {tr(
            "Access denied or failed to load ops telemetry.",
            "Acesso negado ou falha ao carregar a telemetria operacional."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldAlert className="h-6 w-6 text-[var(--accent)]" />
          {tr("Nikki Ops (Admin Telemetry)", "Nikki Ops (Telemetria Admin)")}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {tr(
            "Aggregated non-PII diagnostic reports, error events, and administrative audit logs.",
            "Relatórios de diagnóstico agregados sem PII, eventos de erro e logs administrativos de auditoria."
          )}
        </p>
      </header>

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--muted)]">
              {tr("Total Accounts", "Total de Contas")}
            </div>
            <div className="mt-1 text-2xl font-bold">{data.totalUsers ?? 0}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--muted)]">
              {tr("Recent Error Events", "Eventos de Erro Recentes")}
            </div>
            <div className="mt-1 text-2xl font-bold">{(data.errors ?? []).length}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs text-[var(--muted)]">
              {tr("Diagnostic Reports", "Relatórios de Diagnóstico")}
            </div>
            <div className="mt-1 text-2xl font-bold">{(data.diagnosticReports ?? []).length}</div>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-400" /> {tr("Error Events", "Eventos de Erro")}
            </h2>
            {(data.errors ?? []).length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                {tr("No recent application errors.", "Nenhum erro recente da aplicação.")}
              </p>
            ) : (
              (data.errors ?? []).map((err) => (
                <div key={err.id} className="rounded-lg border border-[var(--border)] p-2.5 text-xs">
                  <div className="font-medium">
                    [{err.severity}] {err.source}
                  </div>
                  <div className="text-[var(--muted)]">{err.message}</div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Activity className="h-4 w-4 text-[var(--accent)]" />{" "}
              {tr("Diagnostic Reports", "Relatórios de Diagnóstico")}
            </h2>
            {(data.diagnosticReports ?? []).length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                {tr(
                  "No user diagnostic reports submitted.",
                  "Nenhum relatório de diagnóstico enviado pelos usuários."
                )}
              </p>
            ) : (
              (data.diagnosticReports ?? []).map((rep) => (
                <div key={rep.id} className="rounded-lg border border-[var(--border)] p-2.5 text-xs space-y-1">
                  <div className="font-medium">
                    {rep.platform} · v{rep.appVersion}
                  </div>
                  <div className="text-[var(--muted)]">
                    {new Date(rep.createdAt).toLocaleString(locale)}
                  </div>
                  {rep.summary && (
                    <pre className="overflow-x-auto rounded bg-black/20 p-1.5 text-[11px]">
                      {JSON.stringify(rep.summary, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold">
              {tr("Administrative Audit Log", "Log de Auditoria Administrativa")}
            </h2>
            {(data.auditEvents ?? []).length === 0 ? (
              <p className="text-xs text-[var(--muted)]">
                {tr("No audit events recorded yet.", "Nenhum evento de auditoria registrado ainda.")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(data.auditEvents ?? []).map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-[var(--border)] p-2.5 text-xs">
                    <div className="font-medium">{ev.action}</div>
                    <div className="text-[var(--muted)]">
                      {new Date(ev.createdAt).toLocaleString(locale)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
