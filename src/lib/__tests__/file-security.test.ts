import { describe, expect, it } from "vitest";
import {
  parseCsvLine,
  sanitizeCsvText,
  sanitizeFileName,
  validateUploadedFileBuffer,
} from "../file-security";

describe("file-security", () => {
  it("validates PDF and PNG magic numbers regardless of declared MIME", () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n", "utf8");
    const resPdf = validateUploadedFileBuffer({
      buffer: pdf,
      declaredMime: "application/octet-stream",
      fileName: "contract.pdf",
    });
    expect(resPdf.ok).toBe(true);
    if (resPdf.ok) expect(resPdf.detectedMime).toBe("application/pdf");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const resPng = validateUploadedFileBuffer({
      buffer: png,
      declaredMime: "image/png",
      fileName: "scan.png",
    });
    expect(resPng.ok).toBe(true);
    if (resPng.ok) expect(resPng.detectedMime).toBe("image/png");
  });

  it("blocks disguised executables, SVG/HTML extensions, and binary CSVs", () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
    const resExe = validateUploadedFileBuffer({
      buffer: exe,
      declaredMime: "text/plain",
      fileName: "notes.txt",
    });
    expect(resExe.ok).toBe(false);

    const svg = Buffer.from("<svg onload=alert(1)></svg>", "utf8");
    const resSvg = validateUploadedFileBuffer({
      buffer: svg,
      declaredMime: "image/svg+xml",
      fileName: "avatar.svg",
    });
    expect(resSvg.ok).toBe(false);

    expect(() => sanitizeCsvText(Buffer.from([0x4d, 0x5a, 0x00, 0x01]))).toThrow();
  });

  it("sanitizes path traversal in filenames and parses quoted CSV lines", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\fakepath\\my..report?.pdf")).toBe("my.report_.pdf");

    expect(parseCsvLine('2026-11-01;"Mercado, ""Central""";"-120,50"', ";")).toEqual([
      "2026-11-01",
      'Mercado, "Central"',
      "-120,50",
    ]);
  });
});
