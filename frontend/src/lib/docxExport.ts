import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ExternalHyperlink,
} from "docx";
import { saveAs } from "file-saver";
import type { Resume, ResumeData } from "./types";
import { deduplicateSectionOrder } from "./types";

function p(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function sectionHeading(title: string, accent: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 24,
        color: accent.replace("#", ""),
      }),
    ],
  });
}

function safeHex(c: string | undefined, fb = "111827"): string {
  if (!c) return fb;
  return c.replace("#", "").padEnd(6, "0").slice(0, 6);
}

export async function exportResumeAsDocx(resume: Resume) {
  const data: ResumeData = resume.data || ({} as ResumeData);
  const accent = safeHex(resume.theme?.accentColor, "2563eb");
  const primary = safeHex(resume.theme?.primaryColor, "0f172a");
  const personal = data.personal || {};
  const defaultOrder = ["summary", "experience", "education", "projects", "skills", "certifications", "achievements", "languages"];
  const order = data.sectionOrder?.length
    ? deduplicateSectionOrder(data.sectionOrder)
    : defaultOrder;

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: personal.fullName || "", bold: true, size: 44, color: primary }),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: personal.title || "", size: 24, color: accent })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: [personal.email, personal.phone, personal.location, personal.website, personal.linkedin, personal.github]
            .filter(Boolean)
            .join("  ·  "),
          size: 18,
          color: "555555",
        }),
      ],
      spacing: { after: 200 },
    }),
  );

  for (const key of order) {
    if (key === "summary" && data.summary) {
      children.push(sectionHeading("Summary", `#${accent}`));
      children.push(p(data.summary, { size: 20 }));
    } else if (key === "experience" && data.experience?.length) {
      children.push(sectionHeading("Experience", `#${accent}`));
      for (const e of data.experience) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${e.role || ""}`, bold: true, size: 22 }),
              new TextRun({ text: e.company ? `  —  ${e.company}` : "", size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – "),
                size: 18,
                color: "666666",
              }),
              new TextRun({ text: e.location ? `  ·  ${e.location}` : "", size: 18, color: "666666" }),
            ],
          }),
        );
        for (const b of e.bullets || []) children.push(bullet(b));
      }
    } else if (key === "education" && data.education?.length) {
      children.push(sectionHeading("Education", `#${accent}`));
      for (const e of data.education) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${e.degree || ""}${e.field ? `, ${e.field}` : ""}`, bold: true, size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: e.school || "", size: 20 }),
              new TextRun({ text: e.location ? `  ·  ${e.location}` : "", size: 18, color: "666666" }),
              new TextRun({
                text: ` ${[e.startDate, e.endDate].filter(Boolean).join(" – ")}`,
                size: 18,
                color: "666666",
              }),
            ],
          }),
        );
        if (e.description) children.push(p(e.description, { size: 18 }));
      }
    } else if (key === "projects" && data.projects?.length) {
      children.push(sectionHeading("Projects", `#${accent}`));
      for (const e of data.projects) {
        const head = new Paragraph({
          children: [
            new TextRun({ text: e.name || "", bold: true, size: 22 }),
            ...(e.link
              ? [
                  new TextRun({ text: "  ·  ", size: 18, color: "666666" }),
                  new ExternalHyperlink({
                    link: e.link.startsWith("http") ? e.link : `https://${e.link}`,
                    children: [new TextRun({ text: e.link, size: 18, color: accent, underline: {} })],
                  }) as unknown as TextRun,
                ]
              : []),
          ],
        });
        children.push(head);
        if (e.description) children.push(p(e.description, { size: 20 }));
        for (const b of e.bullets || []) children.push(bullet(b));
        if (e.technologies?.length)
          children.push(p(e.technologies.join(" · "), { size: 18, color: "666666" }));
      }
    } else if (key === "skills" && data.skills?.length) {
      children.push(sectionHeading("Skills", `#${accent}`));
      for (const g of data.skills) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${g.category || "Skills"}: `, bold: true, size: 20 }),
              new TextRun({ text: (g.items || []).join(", "), size: 20 }),
            ],
          }),
        );
      }
    } else if (key === "certifications" && data.certifications?.length) {
      children.push(sectionHeading("Certifications", `#${accent}`));
      for (const c of data.certifications) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: c.title || "", bold: true, size: 20 }),
              new TextRun({ text: c.subtitle ? `  ·  ${c.subtitle}` : "", size: 20 }),
              new TextRun({ text: c.date ? `  ·  ${c.date}` : "", size: 18, color: "666666" }),
            ],
          }),
        );
      }
    } else if (key === "achievements" && data.achievements?.length) {
      children.push(sectionHeading("Achievements", `#${accent}`));
      for (const c of data.achievements) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: c.title || "", bold: true, size: 20 }),
              new TextRun({ text: c.subtitle ? `  ·  ${c.subtitle}` : "", size: 20 }),
              new TextRun({ text: c.date ? `  ·  ${c.date}` : "", size: 18, color: "666666" }),
            ],
          }),
        );
      }
    } else if (key === "languages" && data.languages?.length) {
      children.push(sectionHeading("Languages", `#${accent}`));
      children.push(
        p((data.languages || []).map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join("   ·   "), {
          size: 20,
        }),
      );
    }
  }

  for (const cs of data.custom || []) {
    children.push(sectionHeading(cs.title || "Custom", `#${accent}`));
    for (const it of cs.items || []) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: it.title || "", bold: true, size: 20 }),
            new TextRun({ text: it.subtitle ? `  ·  ${it.subtitle}` : "", size: 20 }),
            new TextRun({ text: it.date ? `  ·  ${it.date}` : "", size: 18, color: "666666" }),
          ],
        }),
      );
      if (it.description) children.push(p(it.description, { size: 20 }));
    }
  }

  const doc = new Document({
    creator: "AI Resume Builder",
    title: resume.title,
    styles: {
      default: {
        document: { run: { font: resume.theme?.fontFamily || "Inter" } },
        heading1: { run: { color: primary } },
      } as never,
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${resume.title || "resume"}.docx`);
}
