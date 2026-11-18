"use client";

import React, { useMemo, useState } from "react";
import { common, createLowlight } from "lowlight";
import { Check, Copy } from "lucide-react";

const lowlight = createLowlight(common);

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
}

function renderHast(node: HastNode, keyPrefix: string): React.ReactNode {
  if (node.type === "text") {
    return node.value ?? "";
  }
  if (node.type === "element" || node.type === "root") {
    const children = (node.children ?? []).map((child, idx) =>
      renderHast(child, `${keyPrefix}-${idx}`)
    );
    if (node.type === "root") return children;
    const cls = node.properties?.className?.join(" ") ?? "";
    return (
      <span key={keyPrefix} className={cls}>
        {children}
      </span>
    );
  }
  return null;
}

export function CodeHighlight({
  code,
  language,
  showLineNumbers = true,
}: {
  code: string;
  language: string;
  showLineNumbers?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    try {
      const lang = lowlight.registered(language) ? language : "plaintext";
      if (lang === "plaintext") return null;
      const tree = lowlight.highlight(lang, code);
      return renderHast(tree as unknown as HastNode, "hl");
    } catch {
      return null;
    }
  }, [code, language]);

  const lines = useMemo(() => code.split("\n"), [code]);

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[#0d1117] text-[#e6edf3]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] text-white/60">
        <span className="font-mono uppercase">{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
        <div className="flex gap-4">
          {showLineNumbers && (
            <div
              aria-hidden
              className="select-none text-right text-white/30 shrink-0"
            >
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
          )}
          <pre className="tiptap-code-block flex-1 whitespace-pre">
            <code>{highlighted ?? code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
