import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTemplates,
  useCreateResume,
  getListResumesQueryKey,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResumeRender } from "@/templates/Render";
import { sampleData, defaultTheme } from "@/lib/defaults";
import { motion, useInView } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Wand2,
  ListChecks,
  FileDown,
  Upload,
  Palette,
  Layers,
  Target,
  Zap,
  Shield,
  Brain,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function Landing() {
  const { data: templates } = useListTemplates();
  const create = useCreateResume();
  const qc = useQueryClient();
  const [, setLoc] = useLocation();

  async function startWith(templateId: string, name: string) {
    try {
      const res = await create.mutateAsync({
        data: { title: `${name} Resume`, templateId },
      });
      qc.invalidateQueries({ queryKey: getListResumesQueryKey() });
      setLoc(`/builder/${res.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    }
  }

  return (
    <AppShell>
      <Hero onStart={() => startWith("modern", "Modern")} />
      <Stats />
      <Features />
      <TemplateMarquee
        templates={templates || []}
        onUse={(id, name) => startWith(id, name)}
      />
      <AtsShowcase />
      <Testimonials />
      <CtaSection onStart={() => startWith("modern", "Modern")} />
    </AppShell>
  );
}

/* ───────── Hero ───────── */

function Hero({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <BackgroundOrbs />
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center relative">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/5 text-primary mb-5">
              <Sparkles className="size-3" /> AI-powered · ATS-friendly
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Land more interviews with{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                jobX
              </span>
              .
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              The AI resume builder for serious job seekers. Pick from 12
              hand-crafted templates, write with AI, score against any job
              description, and export a perfectly-paginated PDF — in minutes.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              <Button size="lg" className="gap-2 h-12 px-6 text-base" onClick={onStart}>
                <Sparkles className="size-4" /> Build my resume
                <ArrowRight className="size-4" />
              </Button>
              <Link href="/templates">
                <Button size="lg" variant="outline" className="gap-2 h-12 px-6 text-base">
                  <Layers className="size-4" /> Browse templates
                </Button>
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Free to use
              </div>
              <div className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> ATS-optimized
              </div>
              <div className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> PDF + DOCX
              </div>
              <div className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> Live page preview
              </div>
            </div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

function BackgroundOrbs() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 35%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--accent) 40%, transparent), transparent)",
        }}
      />
      <FloatingCircle className="top-12 right-1/3 size-3 bg-primary/60" delay={0} />
      <FloatingCircle className="top-1/3 left-10 size-2 bg-accent/70" delay={0.4} />
      <FloatingCircle className="bottom-20 left-1/4 size-3 bg-primary/40" delay={0.8} />
    </>
  );
}

function FloatingCircle({ className, delay }: { className?: string; delay: number }) {
  return (
    <motion.span
      aria-hidden
      className={`absolute rounded-full ${className || ""}`}
      animate={{ y: [0, -12, 0] }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function HeroPreview() {
  const previewResume = useMemo(
    () => ({
      id: "hero",
      title: "Hero Preview",
      templateId: "modern",
      theme: { ...defaultTheme(), accentColor: "#3b3df1" },
      data: sampleData(),
    }),
    [],
  );
  return (
    <div className="relative">
      <div className="absolute -top-8 -left-8 hidden md:block">
        <ScoreOrb score={92} label="ATS Score" />
      </div>
      <div className="absolute -bottom-6 -right-4 hidden md:block">
        <FloatingChip icon={<Wand2 className="size-3.5" />} text="AI summary" />
      </div>
      <div className="absolute top-1/2 -right-8 hidden md:block">
        <FloatingChip icon={<FileDown className="size-3.5" />} text="PDF ready" />
      </div>
      <div
        className="rounded-2xl border border-border bg-white shadow-2xl shadow-primary/10 overflow-hidden"
        style={{ height: 460 }}
      >
        <div
          style={{
            transform: "scale(0.62)",
            transformOrigin: "top left",
            width: "8.5in",
          }}
        >
          <ResumeRender resume={previewResume as never} />
        </div>
      </div>
    </div>
  );
}

function FloatingChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-full bg-card border border-border shadow-lg px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5"
    >
      <span className="text-primary">{icon}</span>
      {text}
    </motion.div>
  );
}

function ScoreOrb({ score, label }: { score: number; label: string }) {
  const data = [{ name: "score", value: score, fill: "var(--primary)" }];
  return (
    <div className="rounded-2xl bg-card border border-border shadow-lg px-3 py-3 w-32 flex flex-col items-center">
      <div style={{ width: 88, height: 88 }}>
        <ResponsiveContainer>
          <RadialBarChart innerRadius="65%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
            <RadialBar dataKey="value" background={{ fill: "color-mix(in oklab, var(--primary) 12%, transparent)" }} cornerRadius={20} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="-mt-[68px] text-center pointer-events-none">
          <div className="text-2xl font-bold leading-none">{score}</div>
        </div>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
    </div>
  );
}

/* ───────── Stats ───────── */

function Stats() {
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatBig number={124} suffix="K" label="Resumes built" />
        <StatBig number={92} suffix="%" label="Pass ATS scans" />
        <StatBig number={12} label="Templates" />
        <StatBig number={3.4} suffix="×" decimals={1} label="More interviews" />
      </div>
    </section>
  );
}

function StatBig({
  number,
  suffix = "",
  label,
  decimals = 0,
}: {
  number: number;
  suffix?: string;
  label: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const dur = 1100;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(Number((eased * number).toFixed(decimals)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, number, decimals]);
  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-extrabold tracking-tight">
        {decimals === 0 ? Math.round(n) : n.toFixed(decimals)}
        <span className="text-primary">{suffix}</span>
      </div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/* ───────── Features ───────── */

function Features() {
  const features = [
    {
      icon: <Brain className="size-5" />,
      title: "AI you'll actually use",
      desc: "Generate a tailored summary, rewrite weak bullets, and surface skills you forgot — all powered by Groq.",
    },
    {
      icon: <Layers className="size-5" />,
      title: "12 hand-crafted templates",
      desc: "Modern, classic, executive, technical, creative — every template is print-ready and ATS-tested.",
    },
    {
      icon: <ListChecks className="size-5" />,
      title: "Real ATS scoring",
      desc: "Paste a job description and get a 0–100 score with specific strengths and improvements.",
    },
    {
      icon: <Upload className="size-5" />,
      title: "Import your old resume",
      desc: "Upload PDF, DOCX, or JSON and we'll extract every section into the editor automatically.",
    },
    {
      icon: <Palette className="size-5" />,
      title: "Total customization",
      desc: "Fonts, sizes, spacing, accent colors, and one-click two-column layouts. Your resume, your style.",
    },
    {
      icon: <FileDown className="size-5" />,
      title: "Pixel-perfect export",
      desc: "Export to PDF or DOCX. Page-break preview shows exactly how each page will print.",
    },
  ];
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <SectionHeader
        eyebrow="Features"
        title="Everything you need to land the role."
        sub="A complete resume system — built around AI, ATS, and beautiful design."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
          >
            <Card className="p-6 h-full bg-card border-card-border hover-elevate group">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <div className="font-semibold text-base">{f.title}</div>
              <p className="text-sm text-muted-foreground mt-1.5">{f.desc}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ───────── Templates marquee ───────── */

function TemplateMarquee({
  templates,
  onUse,
}: {
  templates: { id: string; name: string; description?: string; accentColor: string; fontFamily: string; layout: string; category?: string }[];
  onUse: (id: string, name: string) => void;
}) {
  return (
    <section className="border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <SectionHeader
          eyebrow="Templates"
          title="12 templates. 0 boring."
          sub="Each template is hand-tuned for clarity, ATS compatibility, and printable beauty."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-12">
          {templates.slice(0, 8).map((t, i) => {
            const previewResume = {
              id: `tm-${t.id}`,
              title: t.name,
              templateId: t.id,
              theme: {
                ...defaultTheme(),
                accentColor: t.accentColor,
                fontFamily: t.fontFamily,
                layout: t.layout as "single" | "two-column",
              },
              data: sampleData(),
            };
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <button
                  onClick={() => onUse(t.id, t.name)}
                  className="group block w-full text-left rounded-xl bg-card border border-card-border overflow-hidden hover-elevate"
                >
                  <div className="bg-white relative" style={{ height: 220 }}>
                    <div
                      style={{
                        transform: "scale(0.27)",
                        transformOrigin: "top left",
                        width: "8.5in",
                      }}
                    >
                      <ResumeRender resume={previewResume as never} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
                      <span className="text-white text-xs font-semibold inline-flex items-center gap-1">
                        Use template <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <span className="size-3 rounded-full" style={{ background: t.accentColor }} />
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <Link href="/templates">
            <Button variant="outline" className="gap-2">
              <Layers className="size-4" /> See all 12 templates
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ───────── ATS showcase ───────── */

function AtsShowcase() {
  const data = useMemo(
    () => [
      { week: "W1", you: 35, others: 28 },
      { week: "W2", you: 48, others: 31 },
      { week: "W3", you: 62, others: 36 },
      { week: "W4", you: 74, others: 41 },
      { week: "W5", you: 86, others: 44 },
      { week: "W6", you: 92, others: 48 },
    ],
    [],
  );
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
      <div>
        <SectionHeader
          eyebrow="ATS Score"
          title="Know exactly how recruiters see you."
          sub="Run your resume through our AI scoring engine. Paste a job description and we'll score keyword overlap, structure, quantification, and clarity — with concrete fixes."
          align="left"
        />
        <ul className="mt-6 space-y-3 text-sm">
          <FeatureBullet icon={<Target className="size-4" />} text="0–100 score against any job description" />
          <FeatureBullet icon={<Zap className="size-4" />} text="Specific, actionable improvements you can make in seconds" />
          <FeatureBullet icon={<Shield className="size-4" />} text="Proven ATS-safe layouts — no graphics traps" />
        </ul>
      </div>
      <Card className="p-6 bg-card border-card-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-muted-foreground">Avg. ATS score</div>
            <div className="text-3xl font-bold">92</div>
          </div>
          <ScoreOrb score={92} label="Today" />
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="you" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="others" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="color-mix(in oklab, var(--border) 60%, transparent)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                }}
              />
              <Area type="monotone" dataKey="others" stroke="var(--muted-foreground)" fill="url(#others)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="you" stroke="var(--primary)" fill="url(#you)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" /> jobX users
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/60" /> Average resume
          </span>
        </div>
        <div className="mt-5 pt-5 border-t border-border">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Section coverage</div>
          <CoverageRing />
        </div>
      </Card>
    </section>
  );
}

function FeatureBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex size-6 rounded-md bg-primary/10 text-primary items-center justify-center">
        {icon}
      </span>
      <span>{text}</span>
    </li>
  );
}

function CoverageRing() {
  const data = [
    { name: "Summary", value: 22, color: "var(--primary)" },
    { name: "Experience", value: 30, color: "var(--accent)" },
    { name: "Skills", value: 18, color: "color-mix(in oklab, var(--primary) 50%, var(--accent))" },
    { name: "Education", value: 15, color: "color-mix(in oklab, var(--primary) 70%, white)" },
    { name: "Projects", value: 15, color: "color-mix(in oklab, var(--accent) 60%, white)" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 items-center">
      <div style={{ height: 140 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={36} outerRadius={60} paddingAngle={3} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="text-muted-foreground">{d.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Testimonials ───────── */

function Testimonials() {
  const items = [
    {
      quote:
        "I rebuilt my resume in 20 minutes and started getting callbacks the next week. The ATS scoring told me exactly what to fix.",
      name: "Priya S.",
      role: "Senior Software Engineer",
    },
    {
      quote:
        "The AI bullet rewriter is wild. It turned vague responsibilities into specific, measurable wins.",
      name: "Daniel R.",
      role: "Product Manager",
    },
    {
      quote:
        "Twelve templates, all of them actually good. My designer friends approved the Creative one.",
      name: "Maya K.",
      role: "UX Designer",
    },
  ];
  return (
    <section className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <SectionHeader eyebrow="Loved by job seekers" title="Real wins, real interviews." />
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {items.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
            >
              <Card className="p-6 h-full bg-card border-card-border">
                <div className="text-primary text-2xl leading-none">“</div>
                <p className="text-sm mt-2 leading-relaxed">{t.quote}</p>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── CTA ───────── */

function CtaSection({ onStart }: { onStart: () => void }) {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-20 pt-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-10 md:p-14 text-center relative overflow-hidden">
        <FloatingCircle className="top-6 left-10 size-3 bg-primary/60" delay={0} />
        <FloatingCircle className="bottom-8 right-12 size-2 bg-accent/70" delay={0.3} />
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Your next interview starts with{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            jobX
          </span>
          .
        </h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Build, score, and export a resume that actually gets read. Free to start, no credit card.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Button size="lg" className="gap-2 h-12 px-6 text-base" onClick={onStart}>
            <Sparkles className="size-4" /> Build my resume
            <ArrowRight className="size-4" />
          </Button>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="h-12 px-6 text-base">
              Open my resumes
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : ""}>
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.18em] font-bold text-primary mb-3">
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{title}</h2>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  );
}
