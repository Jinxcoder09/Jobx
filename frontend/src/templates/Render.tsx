import { useEffect, useRef, useState, useMemo, useLayoutEffect } from "react";
import type {
  Resume,
  ResumeData,
  Theme,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  SkillGroup,
  SimpleItem,
} from "@/lib/types";
import { deduplicateSectionOrder } from "@/lib/types";

interface Props {
  resume: Resume;
  zoom?: number;
  showPageGuides?: boolean;
  debugMode?: boolean;
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

function ExperienceItemBlock({ e, theme, templateId }: { e: ExperienceItem; theme: Theme; templateId: string }) {
  const isTimeline = templateId === "timeline";
  const dates = [e.startDate, e.current ? "Present" : e.endDate].filter(Boolean).join(" – ");
  return (
    <div
      style={{
        marginBottom: 14,
        paddingLeft: isTimeline ? 14 : 0,
        borderLeft: isTimeline ? `2px solid ${theme.accentColor}66` : undefined,
        position: "relative",
        breakInside: "avoid",
        pageBreakInside: "avoid",
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
            <li key={i} style={{ marginBottom: 2, breakInside: "avoid", pageBreakInside: "avoid" }}>{b}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EducationItemBlock({ e, theme }: { e: EducationItem; theme: Theme }) {
  return (
    <div style={{ marginBottom: 10, breakInside: "avoid", pageBreakInside: "avoid" }}>
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
  );
}

function ProjectItemBlock({ p, theme }: { p: ProjectItem; theme: Theme }) {
  return (
    <div style={{ marginBottom: 10, breakInside: "avoid", pageBreakInside: "avoid" }}>
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
            <li key={i} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>{b}</li>
          ))}
        </ul>
      ) : null}
      {p.technologies?.length ? (
        <div style={{ marginTop: 4, fontSize: "0.78em", color: theme.secondaryColor }}>
          {p.technologies.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

function SkillItemBlock({ g, theme, compact }: { g: SkillGroup; theme: Theme; compact?: boolean }) {
  return (
    <div style={{ marginBottom: 6, fontSize: compact ? "0.85em" : "0.9em", breakInside: "avoid", pageBreakInside: "avoid" }}>
      <span style={{ fontWeight: 600, color: theme.primaryColor }}>{g.category}: </span>
      <span>{(g.items || []).join(", ")}</span>
    </div>
  );
}

function SimpleItemBlock({ c, theme }: { c: SimpleItem; theme: Theme }) {
  return (
    <div style={{ marginBottom: 6, breakInside: "avoid", pageBreakInside: "avoid" }}>
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

export function ResumeRender({ resume, zoom = 1, showPageGuides = false, debugMode = false }: Props) {
  const data = resume.data || ({} as ResumeData);
  const theme = resume.theme || ({} as Theme);
  const templateId = resume.templateId || "modern";

  const defaultOrder = ["summary", "experience", "education", "projects", "skills", "certifications", "achievements", "languages"];
  const order = data.sectionOrder?.length
    ? deduplicateSectionOrder(data.sectionOrder)
    : defaultOrder;

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
  const measureRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});

  useLayoutEffect(() => {
    const container = measureRef.current;
    if (!container) return;

    const elements = container.querySelectorAll("[data-flowable-id]");
    const newHeights: Record<string, number> = {};
    let changed = false;

    elements.forEach((el: any) => {
      const id = el.dataset.flowableId;
      const h = el.offsetHeight;
      if (heights[id] !== h) {
        newHeights[id] = h;
        changed = true;
      } else {
        newHeights[id] = heights[id];
      }
    });

    if (changed) {
      setHeights(newHeights);
    }
  }, [resume, heights]);

  const getFlowablesForSection = (key: string) => {
    const list: any[] = [];
    
    if (key === "summary" && data.summary) {
      list.push({
        id: "summary",
        render: () => (
          <div className="resume-section summary-item" style={{ marginBottom: theme.sectionSpacing, breakInside: "avoid", pageBreakInside: "avoid" }}>
            <SectionTitle theme={theme} templateId={templateId}>Summary</SectionTitle>
            <div style={{ fontSize: "0.95em" }}>{data.summary}</div>
          </div>
        )
      });
    }
    
    if (key === "experience" && data.experience?.length) {
      data.experience.forEach((item, index) => {
        list.push({
          id: `experience_${index}`,
          render: () => (
            <div className="resume-section experience-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {index === 0 && <SectionTitle theme={theme} templateId={templateId}>Experience</SectionTitle>}
              <ExperienceItemBlock e={item} theme={theme} templateId={templateId} />
            </div>
          )
        });
      });
    }
    
    if (key === "education" && data.education?.length) {
      data.education.forEach((item, index) => {
        list.push({
          id: `education_${index}`,
          render: () => (
            <div className="resume-section education-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {index === 0 && <SectionTitle theme={theme} templateId={templateId}>Education</SectionTitle>}
              <EducationItemBlock e={item} theme={theme} />
            </div>
          )
        });
      });
    }

    if (key === "projects" && data.projects?.length) {
      data.projects.forEach((item, index) => {
        list.push({
          id: `projects_${index}`,
          render: () => (
            <div className="resume-section project-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {index === 0 && <SectionTitle theme={theme} templateId={templateId}>Projects</SectionTitle>}
              <ProjectItemBlock p={item} theme={theme} />
            </div>
          )
        });
      });
    }

    if (key === "skills" && data.skills?.length) {
      data.skills.forEach((item, index) => {
        list.push({
          id: `skills_${index}`,
          render: () => (
            <div className="resume-section skill-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {index === 0 && <SectionTitle theme={theme} templateId={templateId}>Skills</SectionTitle>}
              <SkillItemBlock g={item} theme={theme} />
            </div>
          )
        });
      });
    }

    if (key === "certifications" && data.certifications?.length) {
      data.certifications.forEach((item, index) => {
        list.push({
          id: `certifications_${index}`,
          render: () => (
            <div className="resume-section certification-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {index === 0 && <SectionTitle theme={theme} templateId={templateId}>Certifications</SectionTitle>}
              <SimpleItemBlock c={item} theme={theme} />
            </div>
          )
        });
      });
    }

    if (key === "achievements" && data.achievements?.length) {
      data.achievements.forEach((item, index) => {
        list.push({
          id: `achievements_${index}`,
          render: () => (
            <div className="resume-section achievement-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
              {index === 0 && <SectionTitle theme={theme} templateId={templateId}>Achievements</SectionTitle>}
              <SimpleItemBlock c={item} theme={theme} />
            </div>
          )
        });
      });
    }

    if (key === "languages" && data.languages?.length) {
      list.push({
        id: "languages",
        render: () => (
          <div className="resume-section languages-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
            <LanguagesBlock data={data} theme={theme} templateId={templateId} />
          </div>
        )
      });
    }
    
    return list;
  };

  const getSingleFlowables = () => {
    const list: any[] = [];
    
    order.forEach((key) => {
      list.push(...getFlowablesForSection(key));
    });

    if (data.custom?.length) {
      data.custom.forEach((cs) => {
        cs.items?.forEach((item, index) => {
          list.push({
            id: `custom_${cs.id}_${index}`,
            render: () => (
              <div className="resume-section custom-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                {index === 0 && <SectionTitle theme={theme} templateId={templateId}>{cs.title || "Custom"}</SectionTitle>}
                <SimpleItemBlock c={item} theme={theme} />
              </div>
            )
          });
        });
      });
    }

    return list;
  };

  const getLeftFlowables = () => {
    const list: any[] = [];
    const keys = templateId === "creative" ? asideKeys : mainKeys;
    
    keys.forEach((key) => {
      list.push(...getFlowablesForSection(key));
    });
    
    if (data.custom?.length) {
      data.custom.forEach((cs) => {
        cs.items?.forEach((item, index) => {
          list.push({
            id: `custom_${cs.id}_${index}`,
            render: () => (
              <div className="resume-section custom-item" style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                {index === 0 && <SectionTitle theme={theme} templateId={templateId}>{cs.title || "Custom"}</SectionTitle>}
                <SimpleItemBlock c={item} theme={theme} />
              </div>
            )
          });
        });
      });
    }
    
    return list;
  };

  const getRightFlowables = () => {
    const list: any[] = [];
    const keys = templateId === "creative" ? mainKeys : asideKeys;
    
    keys.forEach((key) => {
      list.push(...getFlowablesForSection(key));
    });
    
    return list;
  };

  const partitionedPages = useMemo(() => {
    const ids = Object.keys(heights);
    if (ids.length === 0) return [];

    const getH = (id: string) => heights[id] || 0;
    const pageMaxH = 1008; // 1123px (A4) - 115.2px (Margins) = 1007.8px

    if (!isTwo) {
      const pages: any[][] = [];
      let currentPage: any[] = [];
      let currentH = 0;

      const headerH = getH("header");
      currentH += headerH;

      const singleFlowables = getSingleFlowables();

      singleFlowables.forEach((f) => {
        const h = getH(f.id);
        if (currentH + h > pageMaxH && currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [f];
          currentH = h;
        } else {
          currentPage.push(f);
          currentH += h;
        }
      });
      if (currentPage.length > 0) {
        pages.push(currentPage);
      }
      return pages;
    } else {
      const headerH = getH("header");
      const leftFlowables = getLeftFlowables();
      const rightFlowables = getRightFlowables();

      const leftPages: any[][] = [];
      let currentLeftPage: any[] = [];
      let currentLeftH = headerH;
      
      leftFlowables.forEach((f) => {
        const h = getH(f.id);
        if (currentLeftH + h > pageMaxH && currentLeftPage.length > 0) {
          leftPages.push(currentLeftPage);
          currentLeftPage = [f];
          currentLeftH = h;
        } else {
          currentLeftPage.push(f);
          currentLeftH += h;
        }
      });
      if (currentLeftPage.length > 0) {
        leftPages.push(currentLeftPage);
      }

      const rightPages: any[][] = [];
      let currentRightPage: any[] = [];
      let currentRightH = headerH;
      
      rightFlowables.forEach((f) => {
        const h = getH(f.id);
        if (currentRightH + h > pageMaxH && currentRightPage.length > 0) {
          rightPages.push(currentRightPage);
          currentRightPage = [f];
          currentRightH = h;
        } else {
          currentRightPage.push(f);
          currentRightH += h;
        }
      });
      if (currentRightPage.length > 0) {
        rightPages.push(currentRightPage);
      }

      const totalPages = Math.max(leftPages.length, rightPages.length);
      const combinedPages: { left: any[]; right: any[] }[] = [];
      for (let i = 0; i < totalPages; i++) {
        combinedPages.push({
          left: leftPages[i] || [],
          right: rightPages[i] || [],
        });
      }
      return combinedPages;
    }
  }, [heights, isTwo]);

  return (
    <div
      className="resume-page-container"
      style={{
        width: 794 * zoom,
        transform: `scale(${zoom})`,
        transformOrigin: "top left",
        position: "relative",
      }}
    >
      <style>{`
        .resume-page * {
          word-break: break-word;
          overflow-wrap: break-word;
          white-space: normal;
        }
        .flowable-debug-border {
          outline: 1px dashed rgba(239, 68, 68, 0.4);
          position: relative;
        }
        .flowable-debug-badge {
          position: absolute;
          right: 2px;
          top: 2px;
          background: rgba(239, 68, 68, 0.9);
          color: white;
          font-size: 8px;
          padding: 1px 3px;
          border-radius: 2px;
          z-index: 10;
          font-family: monospace;
          pointer-events: none;
        }
      `}</style>

      {/* Hidden Measure Container */}
      <div
        ref={measureRef}
        style={{
          position: "absolute",
          left: -9999,
          top: -9999,
          visibility: "hidden",
          width: "210mm",
          boxSizing: "border-box",
          fontFamily: fontStack(theme.fontFamily),
          fontSize: `${theme.fontSize ?? 11}pt`,
          lineHeight: theme.lineSpacing ?? 1.4,
          color: theme.primaryColor || "#0b0b0c",
        }}
      >
        <div data-flowable-id="header">
          <Header data={data} theme={theme} templateId={templateId} />
        </div>
        
        {isTwo ? (
          <div style={{ display: "grid", gridTemplateColumns: templateId === "creative" ? "1fr 2fr" : "2fr 1fr", gap: 24, padding: "0 0.7in" }}>
            <div style={templateId === "creative" ? { background: `${theme.accentColor}10`, padding: 14, borderRadius: 8 } : {}}>
              {getLeftFlowables().map((f) => (
                <div key={f.id} data-flowable-id={f.id}>
                  {f.render()}
                </div>
              ))}
            </div>
            <div>
              {getRightFlowables().map((f) => (
                <div key={f.id} data-flowable-id={f.id}>
                  {f.render()}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "0 0.7in" }}>
            {getSingleFlowables().map((f) => (
              <div key={f.id} data-flowable-id={f.id}>
                {f.render()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actual Render View */}
      {partitionedPages.length === 0 ? (
        <div
          ref={pageRef}
          className="resume-page"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "0.6in 0.7in",
            boxSizing: "border-box",
            backgroundColor: "white",
            position: "relative",
            margin: "0 auto",
            fontFamily: fontStack(theme.fontFamily),
            fontSize: `${theme.fontSize ?? 11}pt`,
            lineHeight: theme.lineSpacing ?? 1.4,
            color: theme.primaryColor || "#0b0b0c",
          }}
        >
          <Header data={data} theme={theme} templateId={templateId} />
          {isTwo ? (
            <div style={{ display: "grid", gridTemplateColumns: templateId === "creative" ? "1fr 2fr" : "2fr 1fr", gap: 24 }}>
              <div style={templateId === "creative" ? { background: `${theme.accentColor}10`, padding: 14, borderRadius: 8 } : {}}>
                {getLeftFlowables().map((f) => f.render())}
              </div>
              <div>
                {getRightFlowables().map((f) => f.render())}
              </div>
            </div>
          ) : (
            <>
              {getSingleFlowables().map((f) => f.render())}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6 print:gap-0">
          {partitionedPages.map((page, pageIdx) => {
            const pageContentHeight = isTwo 
              ? Math.max(
                  (page as { left: any[]; right: any[] }).left.reduce((sum: number, f: any) => sum + (heights[f.id] || 0), 0),
                  (page as { left: any[]; right: any[] }).right.reduce((sum: number, f: any) => sum + (heights[f.id] || 0), 0)
                ) + (pageIdx === 0 ? heights["header"] || 0 : 0)
              : (page as any[]).reduce((sum: number, f: any) => sum + (heights[f.id] || 0), 0) + (pageIdx === 0 ? heights["header"] || 0 : 0);

            const isOverflow = pageContentHeight > 1008;

            return (
              <div
                key={pageIdx}
                className="resume-page relative"
                style={{
                  width: "210mm",
                  height: "297mm",
                  padding: "0.6in 0.7in",
                  boxSizing: "border-box",
                  backgroundColor: "white",
                  margin: "0 auto",
                  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                  fontFamily: fontStack(theme.fontFamily),
                  fontSize: `${theme.fontSize ?? 11}pt`,
                  lineHeight: theme.lineSpacing ?? 1.4,
                  color: theme.primaryColor || "#0b0b0c",
                  overflow: "hidden",
                }}
              >
                {pageIdx === 0 && (
                  <div className={debugMode ? "flowable-debug-border" : ""}>
                    <Header data={data} theme={theme} templateId={templateId} />
                    {debugMode && (
                      <div className="flowable-debug-badge">
                        header ({heights["header"] || 0}px)
                      </div>
                    )}
                  </div>
                )}
                
                {isTwo ? (
                  <div style={{ display: "grid", gridTemplateColumns: templateId === "creative" ? "1fr 2fr" : "2fr 1fr", gap: 24, height: "100%" }}>
                    <div style={templateId === "creative" ? { background: `${theme.accentColor}10`, padding: 14, borderRadius: 8 } : {}}>
                      {(page as { left: any[]; right: any[] }).left.map((f: any) => (
                        <div key={f.id} className={debugMode ? "flowable-debug-border" : ""}>
                          {f.render()}
                          {debugMode && (
                            <div className="flowable-debug-badge">
                              {f.id} ({heights[f.id] || 0}px)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      {(page as { left: any[]; right: any[] }).right.map((f: any) => (
                        <div key={f.id} className={debugMode ? "flowable-debug-border" : ""}>
                          {f.render()}
                          {debugMode && (
                            <div className="flowable-debug-badge">
                              {f.id} ({heights[f.id] || 0}px)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: "100%" }}>
                    {(page as any[]).map((f: any) => (
                      <div key={f.id} className={debugMode ? "flowable-debug-border" : ""}>
                        {f.render()}
                        {debugMode && (
                          <div className="flowable-debug-badge">
                            {f.id} ({heights[f.id] || 0}px)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showPageGuides && (
                  <div className="absolute right-4 bottom-4 bg-muted px-2 py-1 rounded text-[10px] font-bold tracking-wider text-muted-foreground select-none no-print">
                    PAGE {pageIdx + 1} OF {partitionedPages.length}
                  </div>
                )}

                {debugMode && (
                  <div className="absolute left-4 bottom-4 bg-slate-900/90 text-white px-2 py-1 rounded text-[10px] font-mono select-none no-print flex gap-2 items-center">
                    <span>Content: {Math.round(pageContentHeight)}px / 1008px</span>
                    {isOverflow && (
                      <span className="text-red-400 font-bold">⚠️ OVERFLOW</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
