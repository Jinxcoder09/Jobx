import { useEffect, useRef, useState } from "react";
import type { Resume, ResumeData, Theme } from "@/lib/types";

interface Props {
  resume: Resume;
  zoom?: number;
  showPageGuides?: boolean;
}

const PAGE_HEIGHT_IN = 11;
const PAGE_GAP_IN = 0.18;
const PAGE_PADDING_TOP_IN = 0.6;

function fontStack(name?: string) {
  if (!name) return "Inter, ui-sans-serif, system-ui, sans-serif";
  if (/serif|georgia|merri|lora/i.test(name)) return `"${name}", Georgia, serif`;
  if (/mono/i.test(name)) return `"${name}", Menlo, monospace`;
  return `"${name}", Inter, ui-sans-serif, system-ui, sans-serif`;
}

interface Ctx {
  data: ResumeData;
  theme: Theme;
  templateId: string;
}

function Header({ data, theme, templateId }: Ctx) {
  const p = data.personal || {};
  const meta = [p.email, p.phone, p.location, p.website, p.linkedin, p.github].filter(Boolean);
  if (templateId === "bold") {
    return (
      <div style={{ marginBottom: theme.sectionSpacing }}>
        <div
          style={{
            fontSize: "2.6em",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: theme.primaryColor,
            lineHeight: 1.05,
          }}
        >
          {p.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: "1.05em", color: theme.accentColor, fontWeight: 600, marginTop: 4 }}>
          {p.title}
        </div>
        <div style={{ marginTop: 10, fontSize: "0.85em", color: theme.secondaryColor }}>
          {meta.join("   ·   ")}
        </div>
      </div>
    );
  }
  if (templateId === "elegant" || templateId === "academic" || templateId === "classic") {
    return (
      <div style={{ textAlign: "center", marginBottom: theme.sectionSpacing }}>
        <div style={{ fontSize: "1.9em", letterSpacing: "0.06em", color: theme.primaryColor, fontWeight: 600 }}>
          {(p.fullName || "Your Name").toUpperCase()}
        </div>
        {p.title && (
          <div style={{ fontSize: "0.95em", color: theme.secondaryColor, fontStyle: "italic", marginTop: 4 }}>
            {p.title}
          </div>
        )}
        <div
          style={{
            marginTop: 10,
            fontSize: "0.78em",
            color: theme.secondaryColor,
            borderTop: `1px solid ${theme.accentColor}`,
            borderBottom: `1px solid ${theme.accentColor}`,
            padding: "6px 0",
          }}
        >
          {meta.join("   ·   ")}
        </div>
      </div>
    );
  }
  if (templateId === "executive") {
    return (
      <div style={{ marginBottom: theme.sectionSpacing }}>
        <div style={{ fontSize: "2em", fontWeight: 700, color: theme.primaryColor, letterSpacing: "0.02em" }}>
          {p.fullName || "Your Name"}
        </div>
        <div
          style={{
            fontSize: "0.85em",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: theme.accentColor,
            marginTop: 6,
            fontWeight: 600,
          }}
        >
          {p.title}
        </div>
        <div style={{ marginTop: 10, fontSize: "0.82em", color: theme.secondaryColor }}>
          {meta.join("   |   ")}
        </div>
      </div>
    );
  }
  if (templateId === "modern") {
    return (
      <div
        style={{
          marginBottom: theme.sectionSpacing,
          borderLeft: `4px solid ${theme.accentColor}`,
          paddingLeft: 14,
        }}
      >
        <div style={{ fontSize: "2em", fontWeight: 700, color: theme.primaryColor, letterSpacing: "-0.01em" }}>
          {p.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: "1em", color: theme.accentColor, fontWeight: 500 }}>{p.title}</div>
        <div style={{ marginTop: 8, fontSize: "0.82em", color: theme.secondaryColor }}>
          {meta.join("   ·   ")}
        </div>
      </div>
    );
  }
  if (templateId === "technical") {
    return (
      <div style={{ marginBottom: theme.sectionSpacing, fontFamily: fontStack("JetBrains Mono") }}>
        <div style={{ fontSize: "1.7em", fontWeight: 700, color: theme.primaryColor }}>
          {p.fullName || "Your Name"}
        </div>
        <div style={{ fontSize: "0.95em", color: theme.accentColor }}>// {p.title}</div>
        <div style={{ marginTop: 8, fontSize: "0.78em", color: theme.secondaryColor }}>
          {meta.map((m, i) => (
            <span key={i}>
              {m}
              {i < meta.length - 1 ? "  ·  " : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }
  // minimal / compact / default
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <div style={{ fontSize: "1.8em", fontWeight: 700, color: theme.primaryColor, letterSpacing: "-0.01em" }}>
        {p.fullName || "Your Name"}
      </div>
      {p.title && (
        <div style={{ fontSize: "0.95em", color: theme.secondaryColor, marginTop: 2 }}>{p.title}</div>
      )}
      <div style={{ marginTop: 8, fontSize: "0.82em", color: theme.secondaryColor }}>
        {meta.join("   ·   ")}
      </div>
    </div>
  );
}

function SectionTitle({ children, theme, templateId }: { children: React.ReactNode; theme: Theme; templateId: string }) {
  if (templateId === "executive" || templateId === "elegant" || templateId === "classic" || templateId === "academic") {
    return (
      <div
        style={{
          fontSize: "0.78em",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: theme.accentColor,
          borderBottom: `1px solid ${theme.accentColor}33`,
          paddingBottom: 4,
          marginBottom: 10,
          fontWeight: 700,
        }}
      >
        {children}
      </div>
    );
  }
  if (templateId === "technical") {
    return (
      <div
        style={{
          fontFamily: fontStack("JetBrains Mono"),
          fontSize: "0.85em",
          color: theme.accentColor,
          marginBottom: 8,
          fontWeight: 700,
        }}
      >
        # {children}
      </div>
    );
  }
  if (templateId === "bold") {
    return (
      <div
        style={{
          fontSize: "1.05em",
          fontWeight: 800,
          color: theme.primaryColor,
          marginBottom: 8,
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        fontSize: "0.85em",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: theme.accentColor,
        fontWeight: 700,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function ExperienceBlock({ data, theme, templateId }: Ctx) {
  if (!data.experience?.length) return null;
  const isTimeline = templateId === "timeline";
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>Experience</SectionTitle>
      {data.experience.map((e) => {
        const dates = [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – ");
        return (
          <div
            key={e.id || e.company || Math.random()}
            style={{
              marginBottom: 14,
              paddingLeft: isTimeline ? 14 : 0,
              borderLeft: isTimeline ? `2px solid ${theme.accentColor}66` : undefined,
              position: "relative",
            }}
          >
            {isTimeline && (
              <span
                style={{
                  position: "absolute",
                  left: -5,
                  top: 5,
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: theme.accentColor,
                }}
              />
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, color: theme.primaryColor }}>{e.role}</span>
                {e.company && (
                  <span style={{ color: theme.secondaryColor }}>
                    {" "}
                    · {e.company}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.78em", color: theme.secondaryColor, whiteSpace: "nowrap" }}>{dates}</div>
            </div>
            {e.location && (
              <div style={{ fontSize: "0.78em", color: theme.secondaryColor, marginBottom: 4 }}>{e.location}</div>
            )}
            {e.bullets?.length ? (
              <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                {e.bullets.map((b, i) => (
                  <li key={i} style={{ marginBottom: 2 }}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EducationBlock({ data, theme, templateId }: Ctx) {
  if (!data.education?.length) return null;
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>Education</SectionTitle>
      {data.education.map((e) => (
        <div key={e.id || e.school || Math.random()} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600, color: theme.primaryColor }}>
                {e.degree}
                {e.field ? `, ${e.field}` : ""}
              </div>
              <div style={{ color: theme.secondaryColor, fontSize: "0.9em" }}>
                {e.school}
                {e.location ? ` · ${e.location}` : ""}
              </div>
            </div>
            <div style={{ fontSize: "0.78em", color: theme.secondaryColor, whiteSpace: "nowrap" }}>
              {[e.startDate, e.endDate].filter(Boolean).join(" – ")}
            </div>
          </div>
          {e.gpa && <div style={{ fontSize: "0.8em", color: theme.secondaryColor }}>GPA {e.gpa}</div>}
          {e.description && <div style={{ fontSize: "0.85em", marginTop: 2 }}>{e.description}</div>}
        </div>
      ))}
    </div>
  );
}

function ProjectsBlock({ data, theme, templateId }: Ctx) {
  if (!data.projects?.length) return null;
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>Projects</SectionTitle>
      {data.projects.map((p) => (
        <div key={p.id || p.name || Math.random()} style={{ marginBottom: 10 }}>
          <div>
            <span style={{ fontWeight: 700, color: theme.primaryColor }}>{p.name}</span>
            {p.link && (
              <span style={{ color: theme.accentColor, fontSize: "0.85em" }}> · {p.link}</span>
            )}
          </div>
          {p.description && <div style={{ fontSize: "0.9em" }}>{p.description}</div>}
          {p.bullets?.length ? (
            <ul style={{ margin: "2px 0 0 18px", padding: 0 }}>
              {p.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
          {p.technologies?.length ? (
            <div style={{ marginTop: 4, fontSize: "0.78em", color: theme.secondaryColor }}>
              {p.technologies.join(" · ")}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SkillsBlock({ data, theme, templateId, compact }: Ctx & { compact?: boolean }) {
  if (!data.skills?.length) return null;
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>Skills</SectionTitle>
      {data.skills.map((g) => (
        <div key={g.id || g.category || Math.random()} style={{ marginBottom: 6, fontSize: compact ? "0.85em" : "0.9em" }}>
          <span style={{ fontWeight: 600, color: theme.primaryColor }}>{g.category}: </span>
          <span>{(g.items || []).join(", ")}</span>
        </div>
      ))}
    </div>
  );
}

function SimpleListBlock({
  title,
  items,
  theme,
  templateId,
}: {
  title: string;
  items: { id?: string; title?: string; subtitle?: string; date?: string; description?: string }[];
  theme: Theme;
  templateId: string;
}) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>{title}</SectionTitle>
      {items.map((c, i) => (
        <div key={c.id || i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div>
              <span style={{ fontWeight: 600, color: theme.primaryColor }}>{c.title}</span>
              {c.subtitle && <span style={{ color: theme.secondaryColor }}> · {c.subtitle}</span>}
            </div>
            {c.date && (
              <div style={{ fontSize: "0.78em", color: theme.secondaryColor, whiteSpace: "nowrap" }}>{c.date}</div>
            )}
          </div>
          {c.description && <div style={{ fontSize: "0.85em" }}>{c.description}</div>}
        </div>
      ))}
    </div>
  );
}

function LanguagesBlock({ data, theme, templateId }: Ctx) {
  if (!data.languages?.length) return null;
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>Languages</SectionTitle>
      <div style={{ fontSize: "0.9em" }}>
        {data.languages.map((l, i) => (
          <span key={l.id || i}>
            {l.name}
            {l.level ? ` (${l.level})` : ""}
            {i < data.languages!.length - 1 ? "   ·   " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryBlock({ data, theme, templateId }: Ctx) {
  if (!data.summary) return null;
  return (
    <div style={{ marginBottom: theme.sectionSpacing }}>
      <SectionTitle theme={theme} templateId={templateId}>Summary</SectionTitle>
      <div style={{ fontSize: "0.95em" }}>{data.summary}</div>
    </div>
  );
}

function CustomBlocks({ data, theme, templateId }: Ctx) {
  if (!data.custom?.length) return null;
  return (
    <>
      {data.custom.map((cs) => (
        <SimpleListBlock
          key={cs.id || cs.title || Math.random()}
          title={cs.title || "Custom"}
          items={cs.items || []}
          theme={theme}
          templateId={templateId}
        />
      ))}
    </>
  );
}

function renderSection(key: string, ctx: Ctx) {
  switch (key) {
    case "summary":
      return <SummaryBlock {...ctx} />;
    case "experience":
      return <ExperienceBlock {...ctx} />;
    case "education":
      return <EducationBlock {...ctx} />;
    case "projects":
      return <ProjectsBlock {...ctx} />;
    case "skills":
      return <SkillsBlock {...ctx} />;
    case "certifications":
      return (
        <SimpleListBlock
          title="Certifications"
          items={ctx.data.certifications || []}
          theme={ctx.theme}
          templateId={ctx.templateId}
        />
      );
    case "achievements":
      return (
        <SimpleListBlock
          title="Achievements"
          items={ctx.data.achievements || []}
          theme={ctx.theme}
          templateId={ctx.templateId}
        />
      );
    case "languages":
      return <LanguagesBlock {...ctx} />;
    default:
      return null;
  }
}

export function ResumeRender({ resume, zoom = 1, showPageGuides = false }: Props) {
  const data = resume.data || ({} as ResumeData);
  const theme = resume.theme || ({} as Theme);
  const templateId = resume.templateId || "modern";

  const order = data.sectionOrder?.length
    ? data.sectionOrder
    : ["summary", "experience", "education", "projects", "skills", "certifications", "achievements", "languages"];

  const ctx: Ctx = { data, theme, templateId };

  const baseStyle: React.CSSProperties = {
    fontFamily: fontStack(theme.fontFamily),
    fontSize: `${theme.fontSize ?? 11}pt`,
    lineHeight: theme.lineSpacing ?? 1.4,
    color: theme.primaryColor || "#0b0b0c",
    padding: "0.6in 0.7in",
  };

  const isTwo =
    theme.layout === "two-column" ||
    templateId === "creative" ||
    templateId === "two-column" ||
    templateId === "timeline";

  const sidebarKeys = ["skills", "languages", "certifications", "achievements"];
  const mainKeys = order.filter((k) => !sidebarKeys.includes(k));
  const asideKeys = order.filter((k) => sidebarKeys.includes(k));

  const pageRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [pageHeightPx, setPageHeightPx] = useState(0);
  const [actualHeight, setActualHeight] = useState(1056);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      const widthPx = el.offsetWidth || 816;
      const inToPx = widthPx / 8.5;
      const usablePageHeight = PAGE_HEIGHT_IN - 2 * PAGE_PADDING_TOP_IN;
      const onePageHeight = inToPx * usablePageHeight;
      const totalContentHeight = el.scrollHeight;
      const count = Math.max(1, Math.ceil(totalContentHeight / Math.max(1, onePageHeight)));
      setPageHeightPx(onePageHeight);
      setPages(count);
      setActualHeight(el.offsetHeight || el.scrollHeight || 1056);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPageGuides, data, theme, templateId]);

  const scaledWidth = 816 * zoom;
  const scaledHeight = actualHeight * zoom;

  return (
    <div
      className="resume-page-wrap"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "top center",
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        display: "inline-block",
      }}
    >
      <div
        ref={pageRef}
        className="resume-page"
        style={{ minHeight: showPageGuides ? Math.max(pageHeightPx, 11 * 96) : undefined }}
      >
        <div style={baseStyle}>
          <Header {...ctx} />
          {isTwo ? (
            <div style={{ display: "grid", gridTemplateColumns: templateId === "creative" ? "1fr 2fr" : "2fr 1fr", gap: 24 }}>
              <div style={templateId === "creative" ? {
                background: `${theme.accentColor}10`,
                padding: 14,
                borderRadius: 8,
              } : {}}>
                {(templateId === "creative" ? asideKeys : mainKeys).map((k) => (
                  <div key={k}>{renderSection(k, ctx)}</div>
                ))}
                {templateId === "creative" && <CustomBlocks {...ctx} />}
              </div>
              <div>
                {(templateId === "creative" ? mainKeys : asideKeys).map((k) => (
                  <div key={k}>{renderSection(k, ctx)}</div>
                ))}
                {templateId !== "creative" && <CustomBlocks {...ctx} />}
              </div>
            </div>
          ) : (
            <>
              {order.map((k) => (
                <div key={k}>{renderSection(k, ctx)}</div>
              ))}
              <CustomBlocks {...ctx} />
            </>
          )}
        </div>
      </div>
      {showPageGuides && pageHeightPx > 0 && pages >= 1 && (
        <div className="page-guide" style={{ top: 0, bottom: 0 }}>
          <div className="page-guide-label" style={{ top: 0 }}>
            Page 1 of {pages}
          </div>
          {pages > 1 && Array.from({ length: pages - 1 }).map((_, i) => {
            const top = (i + 1) * pageHeightPx;
            return (
              <div key={i}>
                <div className="page-guide-line" style={{ top }} />
                <div className="page-guide-label" style={{ top }}>
                  Page {i + 2} of {pages}
                </div>
                <div
                  className="page-guide-fold"
                  style={{ top: top - PAGE_GAP_IN * 48, height: PAGE_GAP_IN * 96 }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
