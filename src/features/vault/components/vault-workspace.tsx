"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileLock2, Plus, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";

interface VaultDoc {
  id: string;
  name: string;
  description: string | null;
  category: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export function VaultWorkspace() {
  const { t, tr, language } = useI18n();
  const locale = language === "pt-BR" ? "pt-BR" : "en-US";
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("identity");
  const [notes, setNotes] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "identity":
        return tr("Identity", "Identidade");
      case "contract":
        return tr("Contract", "Contrato");
      case "medical":
        return tr("Medical", "Médico");
      case "tax":
        return tr("Tax & Finance", "Impostos e Finanças");
      case "other":
        return tr("Other", "Outro");
      default:
        return cat;
    }
  };

  const formatExpiryDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
    return parsed.toLocaleDateString(locale, { timeZone: "UTC" });
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/vault");
    if (!res.ok) return;
    const json = (await res.json()) as { data?: { documents: VaultDoc[] } };
    setDocs(json.data?.documents ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedFile) {
      if (selectedFile.size > MAX_SIZE_BYTES) {
        setErrorMsg(tr("File exceeds the 20 MB limit.", "O arquivo excede o limite de 20 MB."));
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("name", name.trim() || selectedFile.name);
        fd.append("category", category);
        if (notes.trim()) fd.append("description", notes.trim());
        if (expiresAt) fd.append("expiresAt", expiresAt);

        const res = await fetch("/api/vault/upload", {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as { error?: { message?: string } };
        if (!res.ok) {
          setErrorMsg(json.error?.message ?? tr("Failed to upload document.", "Falha ao enviar documento."));
          return;
        }
      } finally {
        setUploading(false);
      }
    } else {
      if (!name.trim()) {
        setErrorMsg(tr("Please select a file or enter a document name.", "Selecione um arquivo ou informe o nome do documento."));
        return;
      }
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: notes.trim() || null,
          category,
          storagePath: `metadata/${Date.now()}`,
          mimeType,
          sizeBytes: 1024,
          expiresAt: expiresAt || null,
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setErrorMsg(json.error?.message ?? tr("Failed to save vault record.", "Falha ao salvar registro no cofre."));
        return;
      }
    }

    setSelectedFile(null);
    setName("");
    setNotes("");
    setExpiresAt("");
    await load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/vault?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileLock2 className="h-6 w-6 text-[var(--accent)]" />
          {t("vault.title")}
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("vault.subtitle")}
        </p>
      </header>

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
      >
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 text-center text-xs">
            <Upload className="h-5 w-5 text-[var(--accent)]" />
            <span className="font-medium">
              {selectedFile
                ? `${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`
                : tr(
                    "Click to upload a file (PDF, PNG, JPG, WEBP, TXT, DOCX — max 20 MB)",
                    "Clique para enviar um arquivo (PDF, PNG, JPG, WEBP, TXT, DOCX — máx. 20 MB)"
                  )}
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
                if (file && !name.trim()) {
                  setName(file.name.replace(/\.[^.]+$/, ""));
                }
              }}
              className="hidden"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">
              {tr("Document Name", "Nome do Documento")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr("e.g. Passport Scan", "ex: Cópia do Passaporte")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              required={!selectedFile}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">
              {tr("Category", "Categoria")}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="identity">{tr("Identity", "Identidade")}</option>
              <option value="contract">{tr("Contract", "Contrato")}</option>
              <option value="medical">{tr("Medical", "Médico")}</option>
              <option value="tax">{tr("Tax & Finance", "Impostos e Finanças")}</option>
              <option value="other">{tr("Other", "Outro")}</option>
            </select>
          </div>
          {!selectedFile && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--muted-foreground)]">
                {tr("Document Type", "Tipo de Documento")}
              </label>
              <select
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="application/pdf">{tr("PDF Document", "Documento PDF")}</option>
                <option value="image/png">{tr("PNG Image", "Imagem PNG")}</option>
                <option value="image/jpeg">{tr("JPEG Image", "Imagem JPEG")}</option>
                <option value="text/plain">{tr("Text Document", "Documento de Texto")}</option>
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">
              {tr("Notes (optional)", "Observações (opcional)")}
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr("e.g. Valid through 2030", "ex: Válido até 2030")}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-[var(--muted-foreground)]">
              {tr("Expiration Date (optional)", "Data de Validade (opcional)")}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>

        {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
        <button
          type="submit"
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />{" "}
          {uploading
            ? tr("Uploading...", "Enviando...")
            : selectedFile
              ? tr("Upload Document", "Enviar Documento")
              : tr("Save Document Record", "Salvar Registro do Documento")}
        </button>
      </form>

      <div className="space-y-2">
        {docs.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            {tr(
              "Your vault is empty. Upload or register private documents above.",
              "Seu cofre está vazio. Envie ou registre documentos privados acima."
            )}
          </div>
        ) : (
          docs.map((doc) => {
            const hasUploadedFile = doc.storagePath.startsWith("vault/");
            return (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
              >
                <div>
                  <div className="font-medium">{doc.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    {categoryLabel(doc.category)} · {Math.max(1, Math.round(doc.sizeBytes / 1024))} KB
                    {doc.expiresAt ? ` · ${tr("Expires", "Validade")} ${formatExpiryDate(doc.expiresAt)}` : ""}
                    {doc.description ? ` · ${doc.description}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasUploadedFile && (
                    <a
                      href={`/api/vault/download/${doc.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <Download className="h-3.5 w-3.5" /> {tr("Download", "Baixar")}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="rounded p-1 text-[var(--muted-foreground)] hover:text-red-500"
                    aria-label={tr("Delete document", "Excluir documento")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
