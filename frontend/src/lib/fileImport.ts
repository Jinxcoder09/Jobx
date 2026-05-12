import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return await extractTextFromPdf(file);
  }
  if (
    lower.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return await extractTextFromDocx(file);
  }
  if (lower.endsWith(".txt") || file.type.startsWith("text/")) {
    return await file.text();
  }
  throw new Error(`Unsupported file type: ${file.name}`);
}

async function extractTextFromPdf(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines: Record<number, string[]> = {};
    for (const item of content.items as Array<{
      str?: string;
      transform?: number[];
    }>) {
      const str = item.str ?? "";
      if (!str) continue;
      const y = Math.round(item.transform?.[5] ?? 0);
      (lines[y] ||= []).push(str);
    }
    const ys = Object.keys(lines)
      .map((n) => Number(n))
      .sort((a, b) => b - a);
    out.push(ys.map((y) => lines[y].join(" ")).join("\n"));
  }
  return out.join("\n\n").trim();
}

async function extractTextFromDocx(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return (result.value || "").trim();
}
