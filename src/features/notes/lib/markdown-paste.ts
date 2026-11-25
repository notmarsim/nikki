function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(trimmed)) {
    return trimmed.replace(/"/g, "&quot;");
  }
  return "#";
}

function parseInlineMarkdown(raw: string): string {
  // Protect inline code spans first
  const codeTokens: string[] = [];
  let text = raw.replace(/`([^`]+)`/g, (_m, code: string) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  text = escapeHtml(text);

  // Links: [label](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    return `<a href="${sanitizeUrl(url)}">${label}</a>`;
  });

  // Bold + Italic: ***text*** or ___text___
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");

  // Bold: **text** or __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Strikethrough: ~~text~~
  text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  // Italic: *text* or _text_
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");

  // Restore inline code spans
  text = text.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx: string) => codeTokens[Number(idx)] ?? "");

  return text;
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function looksLikeMarkdown(text: string): boolean {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return false;

  const lines = normalized.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^#{1,6}\s+\S/.test(line)) return true;
    if (/^>\s+\S/.test(line)) return true;
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true;
    if (/^```/.test(line)) return true;
    if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) return true;
    if (/^\s*[-*+]\s+\S/.test(line)) return true;
    if (/^\s*\d+\.\s+\S/.test(line)) return true;
    if (i + 1 < lines.length && line.includes("|") && isTableSeparator(lines[i + 1]!)) {
      return true;
    }
  }

  return /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/.test(
    normalized
  );
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    const fenceMatch = trimmed.match(/^```([a-zA-Z0-9_-]*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      const classAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      html.push(`<pre><code${classAttr}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      html.push("<hr>");
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      html.push(`<h${level}>${parseInlineMarkdown(headingMatch[2]!.trim())}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!.trim())) {
        quoteLines.push(lines[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      const paragraphs = quoteLines
        .filter((q) => q.length > 0)
        .map((q) => `<p>${parseInlineMarkdown(q)}</p>`)
        .join("");
      html.push(`<blockquote>${paragraphs || "<p></p>"}</blockquote>`);
      continue;
    }

    // Markdown table
    if (i + 1 < lines.length && trimmed.includes("|") && isTableSeparator(lines[i + 1]!)) {
      const headers = splitTableRow(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().includes("|") && !isTableSeparator(lines[i]!)) {
        bodyRows.push(splitTableRow(lines[i]!));
        i++;
      }
      const ths = headers.map((h) => `<th><p>${parseInlineMarkdown(h)}</p></th>`).join("");
      const trs = bodyRows
        .map((row) => {
          const tds = headers
            .map((_, colIdx) => `<td><p>${parseInlineMarkdown(row[colIdx] ?? "")}</p></td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
      html.push(`<table><tbody><tr>${ths}</tr>${trs}</tbody></table>`);
      continue;
    }

    // Task list
    if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i]!)) {
        const m = lines[i]!.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/)!;
        const checked = m[1]!.toLowerCase() === "x" ? "true" : "false";
        items.push(
          `<li data-type="taskItem" data-checked="${checked}"><p>${parseInlineMarkdown(m[2]!)}</p></li>`
        );
        i++;
      }
      html.push(`<ul data-type="taskList">${items.join("")}</ul>`);
      continue;
    }

    // Bullet list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!) && !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[i]!)) {
        const content = lines[i]!.replace(/^\s*[-*+]\s+/, "");
        items.push(`<li><p>${parseInlineMarkdown(content)}</p></li>`);
        i++;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        const content = lines[i]!.replace(/^\s*\d+\.\s+/, "");
        items.push(`<li><p>${parseInlineMarkdown(content)}</p></li>`);
        i++;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph (collect consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^#{1,6}\s+/.test(lines[i]!) &&
      !/^>\s?/.test(lines[i]!.trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]!.trim()) &&
      !/^```/.test(lines[i]!.trim()) &&
      !/^\s*[-*+]\s+/.test(lines[i]!) &&
      !/^\s*\d+\.\s+/.test(lines[i]!) &&
      !(i + 1 < lines.length && lines[i]!.includes("|") && isTableSeparator(lines[i + 1]!))
    ) {
      paraLines.push(lines[i]!.trim());
      i++;
    }
    if (paraLines.length > 0) {
      html.push(`<p>${parseInlineMarkdown(paraLines.join(" "))}</p>`);
    }
  }

  return html.join("");
}
