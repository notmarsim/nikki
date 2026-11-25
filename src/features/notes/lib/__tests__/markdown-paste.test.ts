import { describe, expect, it } from "vitest";
import { looksLikeMarkdown, markdownToHtml } from "../markdown-paste";

describe("markdown-paste", () => {
  it("detects and converts headings, blockquotes, horizontal rules, and tables", () => {
    const sample = `# Caso Acusativo — Вини́тельный паде́ж

O acusativo (Вини́тельный паде́ж) é o quarto dos seis casos gramaticais da língua russa.

> **Nota sobre a pronúncia:** os acentos gráficos indicam a sílaba tônica.

---

# 1. Quando utilizar o acusativo?

| Russo | Português | Utilização |
|---|---|---|
| Кого́? | Quem? | Objeto direto animado |
| Что? | O quê? | Objeto direto inanimado |`;

    expect(looksLikeMarkdown(sample)).toBe(true);
    const html = markdownToHtml(sample);

    expect(html).toContain("<h1>Caso Acusativo — Вини́тельный паде́ж</h1>");
    expect(html).toContain(
      "<blockquote><p><strong>Nota sobre a pronúncia:</strong> os acentos gráficos indicam a sílaba tônica.</p></blockquote>"
    );
    expect(html).toContain("<hr>");
    expect(html).toContain("<h1>1. Quando utilizar o acusativo?</h1>");
    expect(html).toContain("<table><tbody><tr><th><p>Russo</p></th>");
    expect(html).toContain("<td><p>Кого́?</p></td><td><p>Quem?</p></td>");
  });

  it("ignores plain text without markdown syntax", () => {
    expect(looksLikeMarkdown("Apenas uma frase comum sem formatação especial.")).toBe(false);
  });

  it("escapes raw html in pasted markdown", () => {
    const html = markdownToHtml("# Title <script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
