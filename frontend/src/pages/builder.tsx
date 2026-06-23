import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetResume,
  getGetResumeQueryKey,
  useUpdateResume,
  useListTemplates,
  useAiGenerateSummary,
  useAiImproveBullet,
  useAiSuggestSkills,
  useAiFixGrammar,
  useAiAtsScore,
  useAiParseResume,
  exportResumeAsPdf,
  exportResumeAsDocx,
  type Resume,
  type ResumeData,
  type Theme,
  type ExperienceItem,
  type EducationItem,
  type ProjectItem,
  type SkillGroup,
  type SimpleItem,
  type LanguageItem,
  type CustomSection,
} from "@/lib/api";
import { extractTextFromFile } from "@/lib/fileImport";
import { sampleData } from "@/lib/defaults";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ResumeRender } from "@/templates/Render";
import { SortableList, SortableSectionList } from "@/components/SortableList";
import { RichText } from "@/components/RichText";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ChevronLeft,
  Plus,
  Sparkles,
  Settings2,
  Download,
  FileDown,
  Upload,
  Trash2,
  Wand2,
  ListChecks,
  Save,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { FONT_OPTIONS, SECTION_LABELS, uid, deduplicateSectionOrder } from "@/lib/types";
import { defaultTheme, emptyData } from "@/lib/defaults";
import { motion, AnimatePresence } from "framer-motion";

type ActiveSection =
  | "personal"
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "skills"
  | "certifications"
  | "achievements"
  | "languages"
  | "custom";

const SIDE_SECTIONS: { key: ActiveSection; label: string }[] = [
  { key: "personal", label: "Personal Info" },
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "projects", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "certifications", label: "Certifications" },
  { key: "achievements", label: "Achievements" },
  { key: "languages", label: "Languages" },
  { key: "custom", label: "Custom Sections" },
];

export default function Builder() {
  const { id } = useParams<{ id: string }>();
  const [, setLoc] = useLocation();
  const qc = useQueryClient();
  const { data: resume, isLoading } = useGetResume(id, {
    query: { enabled: !!id, queryKey: getGetResumeQueryKey(id) },
  });
  const { data: templates } = useListTemplates();
  const update = useUpdateResume();

  const [draft, setDraft] = useState<Resume | null>(null);
  const [active, setActive] = useState<ActiveSection>("personal");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [showPageGuides, setShowPageGuides] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  // Mobile layout state
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [reorderOpen, setReorderOpen] = useState(false);

  // Dynamic preview width tracking
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(816);

  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewWidth(entry.contentRect.width || 816);
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, [mobileTab]);

  // Calculate responsive zoom level
  const responsiveZoom = useMemo(() => {
    if (previewWidth <= 0) return 0.78;
    const padding = 32; // 16px padding on left/right
    const availableWidth = previewWidth - padding;
    return Math.min(0.78, availableWidth / 816);
  }, [previewWidth]);

  useEffect(() => {
    if (resume && !draft) {
      const safe: Resume = {
        ...resume,
        theme: { ...defaultTheme(), ...(resume.theme || {}) },
        data: { ...emptyData(), ...(resume.data || {}) } as ResumeData,
      };
      setDraft(safe);
    }
  }, [resume, draft]);

  // debounced autosave
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!draft || !id) return;
    if (!dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      update.mutate(
        {
          id,
          data: {
            title: draft.title,
            templateId: draft.templateId,
            theme: draft.theme,
            data: draft.data,
          },
        },
        {
          onSuccess: () => {
            setSavedAt(Date.now());
            dirtyRef.current = false;
            qc.invalidateQueries({ queryKey: getGetResumeQueryKey(id) });
          },
          onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
        },
      );
    }, 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function patchData(p: Partial<ResumeData>) {
    dirtyRef.current = true;
    setDraft((current) => {
      if (!current) return current;
      return { ...current, data: { ...(current.data as ResumeData), ...p } };
    });
  }
  function patchTheme(p: Partial<Theme>) {
    dirtyRef.current = true;
    setDraft((current) => {
      if (!current) return current;
      return { ...current, theme: { ...(current.theme as Theme), ...p } };
    });
  }
  function patchResume(p: Partial<Resume>) {
    dirtyRef.current = true;
    setDraft((current) => (current ? { ...current, ...p } : current));
  }

  if (isLoading || !draft)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading resume…
      </div>
    );

  const data = draft.data as ResumeData;
  const theme = draft.theme as Theme;
  const defaultOrder = ["summary", "experience", "education", "projects", "skills", "certifications", "achievements", "languages"];
  const order = data.sectionOrder?.length
    ? deduplicateSectionOrder(data.sectionOrder)
    : defaultOrder;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar
        draft={draft}
        templates={templates || []}
        savedAt={savedAt}
        saving={update.isPending}
        showPageGuides={showPageGuides}
        onTogglePageGuides={() => setShowPageGuides((v) => !v)}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        onTitle={(v) => patchResume({ title: v })}
        onTemplate={(v) => patchResume({ templateId: v })}
        onPatchTheme={patchTheme}
        onImportOpen={() => setImportOpen(true)}
        onScoreOpen={() => setScoreOpen(true)}
        onLoadSample={() => patchData(sampleData())}
        onPreview={() => window.open(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/preview/${draft.id}`, "_blank")}
        onExportPdf={() => exportResumeAsPdf(draft).catch((e) => toast.error(e.message))}
        onExportDocx={() => exportResumeAsDocx(draft).catch((e) => toast.error(e.message))}
        onBack={() => setLoc("/dashboard")}
        onReorderOpen={() => setReorderOpen(true)}
      />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[224px_minmax(420px,520px)_1fr] min-h-0 relative">
        <SectionsSidebar
          data={data}
          active={active}
          onActive={setActive}
          onReorder={(order) => patchData({ sectionOrder: order })}
        />
        <div className={`border-x border-border min-h-0 flex flex-col ${mobileTab === "edit" ? "flex" : "hidden lg:flex"}`}>
          {/* Horizontal scrollable sections tabs (Mobile/Tablet only) */}
          <div className="lg:hidden border-b border-border bg-sidebar px-4 py-2 overflow-x-auto flex gap-1.5 scrollbar-none shrink-0">
            {SIDE_SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  active === s.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1 h-[calc(100vh-3.5rem)]">
            <div className="p-4 sm:p-6">
              <Editor
                draft={draft}
                active={active}
                patchData={patchData}
              />
            </div>
          </ScrollArea>
        </div>
        <div
          ref={previewContainerRef}
          className={`bg-muted/30 min-h-0 flex flex-col flex-1 ${mobileTab === "preview" ? "flex" : "hidden lg:flex"}`}
        >
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="p-4 flex justify-center items-start">
              <ResumeRender resume={draft} zoom={responsiveZoom} showPageGuides={showPageGuides} debugMode={debugMode} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden h-12 border-t border-border bg-background flex items-center justify-around no-print shrink-0">
        <button
          onClick={() => setMobileTab("edit")}
          className={`flex-1 h-full flex items-center justify-center gap-2 text-sm font-medium border-r border-border transition-colors ${
            mobileTab === "edit" ? "text-primary bg-muted/50" : "text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <Settings2 className="size-4" />
          Edit
        </button>
        <button
          onClick={() => setMobileTab("preview")}
          className={`flex-1 h-full flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
            mobileTab === "preview" ? "text-primary bg-muted/50" : "text-muted-foreground hover:bg-muted/30"
          }`}
        >
          <Eye className="size-4" />
          Preview
        </button>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onLoaded={(d) => patchData(d)}
      />
      <AtsScoreDialog
        open={scoreOpen}
        onOpenChange={setScoreOpen}
        data={data}
      />

      {/* Section Reorder Dialog (Mobile/Tablet only) */}
      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reorder resume sections</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="px-1">
              <SortableSectionList ids={order} onReorder={(next) => patchData({ sectionOrder: next })}>
                {(sid, handle) => (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md hover-elevate border border-border bg-card text-sm mb-2">
                    {handle}
                    <span className="capitalize">{SECTION_LABELS[sid] || sid}</span>
                  </div>
                )}
              </SortableSectionList>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setReorderOpen(false)} className="w-full sm:w-auto">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TopBar({
  draft,
  templates,
  savedAt,
  saving,
  showPageGuides,
  onTogglePageGuides,
  debugMode,
  setDebugMode,
  onTitle,
  onTemplate,
  onPatchTheme,
  onImportOpen,
  onScoreOpen,
  onLoadSample,
  onPreview,
  onExportPdf,
  onExportDocx,
  onBack,
  onReorderOpen,
}: {
  draft: Resume;
  templates: { id: string; name: string }[];
  savedAt: number | null;
  saving: boolean;
  showPageGuides: boolean;
  onTogglePageGuides: () => void;
  debugMode: boolean;
  setDebugMode: (v: boolean) => void;
  onTitle: (v: string) => void;
  onTemplate: (v: string) => void;
  onPatchTheme: (p: Partial<Theme>) => void;
  onImportOpen: () => void;
  onScoreOpen: () => void;
  onLoadSample: () => void;
  onPreview: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onBack: () => void;
  onReorderOpen: () => void;
}) {
  const theme = draft.theme as Theme;
  return (
    <div className="h-14 border-b border-border bg-background/90 backdrop-blur sticky top-0 z-30 flex items-center px-3 gap-2 no-print">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back" className="shrink-0">
        <ChevronLeft className="size-5" />
      </Button>
      <Input
        value={draft.title || ""}
        onChange={(e) => onTitle(e.target.value)}
        className="h-9 w-32 sm:w-44 font-medium"
      />
      <span className="text-xs text-muted-foreground ml-2 hidden sm:inline-flex items-center gap-1 shrink-0">
        {saving ? (
          <>
            <Loader2 className="size-3 animate-spin" /> Saving…
          </>
        ) : savedAt ? (
          <>
            <Save className="size-3" /> Saved
          </>
        ) : (
          "Auto-save on"
        )}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Select value={draft.templateId} onValueChange={onTemplate}>
          <SelectTrigger className="h-9 w-28 sm:w-36 md:w-44 shrink-0">
            <SelectValue placeholder="Template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" className="gap-1.5 px-2 md:px-3">
              <Settings2 className="size-4" />
              <span className="hidden md:inline">Customize</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Customize</SheetTitle>
            </SheetHeader>
            <div className="space-y-5 mt-4">
              <div>
                <Label>Font family</Label>
                <Select value={theme.fontFamily} onValueChange={(v) => onPatchTheme({ fontFamily: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Font size · {theme.fontSize}pt</Label>
                <Slider
                  className="mt-2"
                  min={9}
                  max={14}
                  step={0.5}
                  value={[theme.fontSize ?? 11]}
                  onValueChange={([v]) => onPatchTheme({ fontSize: v })}
                />
              </div>
              <div>
                <Label>Line spacing · {theme.lineSpacing?.toFixed(2)}</Label>
                <Slider
                  className="mt-2"
                  min={1}
                  max={1.8}
                  step={0.05}
                  value={[theme.lineSpacing ?? 1.4]}
                  onValueChange={([v]) => onPatchTheme({ lineSpacing: v })}
                />
              </div>
              <div>
                <Label>Section spacing · {theme.sectionSpacing}px</Label>
                <Slider
                  className="mt-2"
                  min={6}
                  max={32}
                  step={1}
                  value={[theme.sectionSpacing ?? 16]}
                  onValueChange={([v]) => onPatchTheme({ sectionSpacing: v })}
                />
              </div>
              <ColorRow label="Primary" value={theme.primaryColor || "#0f172a"} onChange={(v) => onPatchTheme({ primaryColor: v })} />
              <ColorRow label="Secondary" value={theme.secondaryColor || "#475569"} onChange={(v) => onPatchTheme({ secondaryColor: v })} />
              <ColorRow label="Accent" value={theme.accentColor || "#2563eb"} onChange={(v) => onPatchTheme({ accentColor: v })} />
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Two-column layout</Label>
                <Switch
                  checked={theme.layout === "two-column"}
                  onCheckedChange={(v) => onPatchTheme({ layout: v ? "two-column" : "single" })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Pagination debug mode</Label>
                <Switch
                  checked={debugMode}
                  onCheckedChange={setDebugMode}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop-only individual buttons */}
        <Button
          variant={showPageGuides ? "secondary" : "ghost"}
          className="gap-1.5 hidden lg:inline-flex"
          onClick={onTogglePageGuides}
          title="Toggle page-break guides"
        >
          <FileDown className="size-4" /> Pages
        </Button>
        <Button variant="ghost" className="gap-1.5 hidden lg:inline-flex" onClick={onScoreOpen}>
          <ListChecks className="size-4" /> ATS Score
        </Button>
        <Button variant="ghost" className="gap-1.5 hidden lg:inline-flex" onClick={onImportOpen}>
          <Upload className="size-4" /> Import
        </Button>
        <Button variant="ghost" className="gap-1.5 hidden lg:inline-flex" onClick={onLoadSample} title="Load sample data">
          <Sparkles className="size-4" /> Sample
        </Button>

        {/* Tools Dropdown Menu (Mobile/Tablet only) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="lg:hidden gap-1.5 px-2 md:px-3">
              <Wand2 className="size-4" />
              <span className="hidden sm:inline">Tools</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onTogglePageGuides}>
              <FileDown className="size-4 mr-2" />
              {showPageGuides ? "Hide page guides" : "Show page guides"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onScoreOpen}>
              <ListChecks className="size-4 mr-2" />
              ATS Score
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImportOpen}>
              <Upload className="size-4 mr-2" />
              Import resume
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLoadSample}>
              <Sparkles className="size-4 mr-2" />
              Load sample
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReorderOpen}>
              <Settings2 className="size-4 mr-2" />
              Reorder sections
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="gap-1.5 px-2 md:px-3">
              <Download className="size-4" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Download</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportPdf}>
              <FileDown className="size-4 mr-2" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportDocx}>
              <FileDown className="size-4 mr-2" /> DOCX
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="size-4 mr-2" /> Open print preview
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded-md border border-input bg-background"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-24" />
      </div>
    </div>
  );
}

function SectionsSidebar({
  data,
  active,
  onActive,
  onReorder,
}: {
  data: ResumeData;
  active: ActiveSection;
  onActive: (k: ActiveSection) => void;
  onReorder: (next: string[]) => void;
}) {
  const defaultOrder = ["summary", "experience", "education", "projects", "skills", "certifications", "achievements", "languages"];
  const order = data.sectionOrder?.length
    ? deduplicateSectionOrder(data.sectionOrder)
    : defaultOrder;
  return (
    <div className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-0 no-print">
      <ScrollArea className="h-[calc(100vh-3.5rem)]">
        <div className="p-3 space-y-1">
          <div className="px-2 pt-2 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Editor
          </div>
          {SIDE_SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => onActive(s.key)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm hover-elevate ${active === s.key ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}`}
            >
              {s.label}
            </button>
          ))}
          <div className="px-2 pt-5 pb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Section order
          </div>
          <div className="px-1">
            <SortableSectionList ids={order} onReorder={onReorder}>
              {(sid, handle) => (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate text-sm">
                  {handle}
                  <span className="capitalize">{SECTION_LABELS[sid] || sid}</span>
                </div>
              )}
            </SortableSectionList>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function Editor({
  draft,
  active,
  patchData,
}: {
  draft: Resume;
  active: ActiveSection;
  patchData: (p: Partial<ResumeData>) => void;
}) {
  const data = draft.data as ResumeData;
  const personal = data.personal || {};

  function setField<K extends keyof ResumeData>(k: K, v: ResumeData[K]) {
    patchData({ [k]: v } as Partial<ResumeData>);
  }
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="max-w-2xl mx-auto"
      >
        <h2 className="text-xl font-semibold mb-4">
          {SIDE_SECTIONS.find((s) => s.key === active)?.label}
        </h2>

        {active === "personal" && (
          <Card className="p-5 space-y-3 bg-card border-card-border">
            <Row>
              <FormField label="Full name" value={personal.fullName} onChange={(v) => patchData({ personal: { ...personal, fullName: v } })} />
              <FormField label="Title" value={personal.title} onChange={(v) => patchData({ personal: { ...personal, title: v } })} />
            </Row>
            <Row>
              <FormField label="Email" value={personal.email} onChange={(v) => patchData({ personal: { ...personal, email: v } })} />
              <FormField label="Phone" value={personal.phone} onChange={(v) => patchData({ personal: { ...personal, phone: v } })} />
            </Row>
            <Row>
              <FormField label="Location" value={personal.location} onChange={(v) => patchData({ personal: { ...personal, location: v } })} />
              <FormField label="Website" value={personal.website} onChange={(v) => patchData({ personal: { ...personal, website: v } })} />
            </Row>
            <Row>
              <FormField label="LinkedIn" value={personal.linkedin} onChange={(v) => patchData({ personal: { ...personal, linkedin: v } })} />
              <FormField label="GitHub" value={personal.github} onChange={(v) => patchData({ personal: { ...personal, github: v } })} />
            </Row>
          </Card>
        )}

        {active === "summary" && (
          <SummaryEditor data={data} setField={setField} />
        )}

        {active === "experience" && (
          <ExperienceEditor data={data} setField={setField} />
        )}

        {active === "education" && (
          <EducationEditor data={data} setField={setField} />
        )}

        {active === "projects" && (
          <ProjectsEditor data={data} setField={setField} />
        )}

        {active === "skills" && (
          <SkillsEditor data={data} setField={setField} />
        )}

        {active === "certifications" && (
          <SimpleEditor
            label="Certification"
            items={data.certifications || []}
            onChange={(v) => setField("certifications", v as SimpleItem[])}
          />
        )}

        {active === "achievements" && (
          <SimpleEditor
            label="Achievement"
            items={data.achievements || []}
            onChange={(v) => setField("achievements", v as SimpleItem[])}
          />
        )}

        {active === "languages" && (
          <LanguagesEditor data={data} setField={setField} />
        )}

        {active === "custom" && (
          <CustomEditor data={data} setField={setField} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}
function FormField({ label, value, onChange, type = "text" }: { label: string; value?: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function CommaListInput({
  value,
  onChange,
  placeholder,
}: {
  value?: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState((value || []).join(", "));

  useEffect(() => {
    const next = (value || []).join(", ");
    setText((current) => (parseCommaList(current).join(", ") === next ? current : next));
  }, [value]);

  return (
    <Input
      className="mt-1"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onChange(parseCommaList(next));
      }}
    />
  );
}

function SummaryEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const ai = useAiGenerateSummary();
  const fix = useAiFixGrammar();
  const [role, setRole] = useState("");
  return (
    <Card className="p-5 space-y-3 bg-card border-card-border">
      <div>
        <Label>Professional summary</Label>
        <Textarea
          value={data.summary || ""}
          onChange={(e) => setField("summary", e.target.value)}
          rows={6}
          className="mt-1"
          placeholder="2–4 sentences about who you are, the impact you've made, and what you're looking for."
        />
      </div>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Target role (e.g. Senior Designer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant="secondary"
          className="gap-1.5"
          disabled={ai.isPending || !role}
          onClick={async () => {
            try {
              const out = await ai.mutateAsync({
                data: {
                  role,
                  experience: (data.experience || []).map((e) => `${e.role} at ${e.company}`).join("; "),
                  skills: (data.skills || []).flatMap((s) => s.items || []).join(", "),
                  tone: "professional",
                },
              });
              setField("summary", out.text);
              toast.success("Summary generated");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "AI failed");
            }
          }}
        >
          <Sparkles className="size-4" /> {ai.isPending ? "Generating…" : "Generate with AI"}
        </Button>
        <Button
          variant="ghost"
          className="gap-1.5"
          disabled={fix.isPending || !data.summary}
          onClick={async () => {
            try {
              const out = await fix.mutateAsync({ data: { text: data.summary || "" } });
              setField("summary", out.text);
              toast.success("Grammar polished");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "AI failed");
            }
          }}
        >
          <Wand2 className="size-4" /> Fix grammar
        </Button>
      </div>
    </Card>
  );
}

function ExperienceEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const items = data.experience || [];
  const improve = useAiImproveBullet();
  function update(idx: number, patch: Partial<ExperienceItem>) {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setField("experience", next);
  }
  function add() {
    setField("experience", [
      ...items,
      { id: uid(), company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] },
    ]);
  }
  function remove(idx: number) {
    setField("experience", items.filter((_, i) => i !== idx));
  }
  function addBullet(idx: number, item: ExperienceItem) {
    const bullets = item.bullets || [];
    const nextIndex = bullets.length;
    const itemKey = item.id || String(idx);
    update(idx, { bullets: [...bullets, ""] });
    window.setTimeout(() => {
      const field = document.querySelector<HTMLTextAreaElement>(
        `[data-experience-bullet="${itemKey}:${nextIndex}"]`,
      );
      field?.focus();
    }, 0);
  }
  return (
    <div className="space-y-3">
      <SortableList items={items} onReorder={(v) => setField("experience", v)}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">Position {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => remove(idx)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Row>
              <FormField label="Role" value={it.role} onChange={(v) => update(idx, { role: v })} />
              <FormField label="Company" value={it.company} onChange={(v) => update(idx, { company: v })} />
            </Row>
            <Row>
              <FormField label="Location" value={it.location} onChange={(v) => update(idx, { location: v })} />
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Start" value={it.startDate} onChange={(v) => update(idx, { startDate: v })} />
                <FormField label="End" value={it.current ? "Present" : it.endDate} onChange={(v) => update(idx, { endDate: v })} />
              </div>
            </Row>
            <div className="flex items-center gap-2 mt-1">
              <Switch checked={!!it.current} onCheckedChange={(v) => update(idx, { current: v })} />
              <Label className="cursor-pointer">Currently work here</Label>
            </div>
            <div className="mt-3">
              <Label>Bullet points</Label>
              <div className="space-y-2 mt-1">
                {(it.bullets || []).map((b, bi) => (
                  <div key={bi} className="flex gap-2">
                    <Textarea
                      rows={2}
                      data-experience-bullet={`${it.id || idx}:${bi}`}
                      placeholder="Describe the result, metric, or contribution"
                      value={b}
                      onChange={(e) =>
                        update(idx, { bullets: (it.bullets || []).map((x, i) => (i === bi ? e.target.value : x)) })
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Improve with AI"
                        onClick={async () => {
                          if (!b.trim()) return;
                          try {
                            const out = await improve.mutateAsync({
                              data: { text: b, context: `${it.role} at ${it.company}` },
                            });
                            update(idx, {
                              bullets: (it.bullets || []).map((x, i) => (i === bi ? out.text : x)),
                            });
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "AI failed");
                          }
                        }}
                      >
                        <Sparkles className="size-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update(idx, { bullets: (it.bullets || []).filter((_, i) => i !== bi) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => addBullet(idx, it)}
                >
                  <Plus className="size-4" /> Add bullet
                </Button>
              </div>
            </div>
          </Card>
        )}
      </SortableList>
      <Button onClick={add} variant="outline" className="w-full gap-1.5">
        <Plus className="size-4" /> Add experience
      </Button>
    </div>
  );
}

function EducationEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const items = data.education || [];
  function update(idx: number, patch: Partial<EducationItem>) {
    setField("education", items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      <SortableList items={items} onReorder={(v) => setField("education", v)}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">Education {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setField("education", items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Row>
              <FormField label="School" value={it.school} onChange={(v) => update(idx, { school: v })} />
              <FormField label="Degree" value={it.degree} onChange={(v) => update(idx, { degree: v })} />
            </Row>
            <Row>
              <FormField label="Field" value={it.field} onChange={(v) => update(idx, { field: v })} />
              <FormField label="Location" value={it.location} onChange={(v) => update(idx, { location: v })} />
            </Row>
            <Row>
              <FormField label="Start" value={it.startDate} onChange={(v) => update(idx, { startDate: v })} />
              <FormField label="End" value={it.endDate} onChange={(v) => update(idx, { endDate: v })} />
            </Row>
            <FormField label="GPA" value={it.gpa} onChange={(v) => update(idx, { gpa: v })} />
            <div className="space-y-1 mt-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={it.description || ""} onChange={(e) => update(idx, { description: e.target.value })} />
            </div>
          </Card>
        )}
      </SortableList>
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => setField("education", [...items, { id: uid(), school: "", degree: "", field: "", location: "", startDate: "", endDate: "", gpa: "", description: "" }])}
      >
        <Plus className="size-4" /> Add education
      </Button>
    </div>
  );
}

function ProjectsEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const items = data.projects || [];
  const improve = useAiImproveBullet();
  function update(idx: number, patch: Partial<ProjectItem>) {
    setField("projects", items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addBullet(idx: number, project: ProjectItem) {
    const bullets = project.bullets || [];
    const nextIndex = bullets.length;
    const projectKey = project.id || String(idx);
    update(idx, { bullets: [...bullets, ""] });
    window.setTimeout(() => {
      const field = document.querySelector<HTMLTextAreaElement>(
        `[data-project-bullet="${projectKey}:${nextIndex}"]`,
      );
      field?.focus();
    }, 0);
  }
  return (
    <div className="space-y-3">
      <SortableList items={items} onReorder={(v) => setField("projects", v)}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">Project {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setField("projects", items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Row>
              <FormField label="Name" value={it.name} onChange={(v) => update(idx, { name: v })} />
              <FormField label="Link" value={it.link} onChange={(v) => update(idx, { link: v })} />
            </Row>
            <div className="space-y-1 mt-2">
              <Label>Description</Label>
              <Textarea rows={2} value={it.description || ""} onChange={(e) => update(idx, { description: e.target.value })} />
            </div>
            <div className="mt-3">
              <Label>Bullets</Label>
              <div className="space-y-2 mt-1">
                {(it.bullets || []).map((b, bi) => (
                  <div key={bi} className="flex gap-2">
                    <Textarea
                      rows={2}
                      data-project-bullet={`${it.id || idx}:${bi}`}
                      placeholder="Describe the result, metric, or contribution"
                      value={b}
                      onChange={(e) => update(idx, { bullets: (it.bullets || []).map((x, i) => (i === bi ? e.target.value : x)) })}
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Improve with AI"
                        onClick={async () => {
                          if (!b.trim()) return;
                          try {
                            const out = await improve.mutateAsync({
                              data: { text: b, context: `${it.name} project` },
                            });
                            update(idx, {
                              bullets: (it.bullets || []).map((x, i) => (i === bi ? out.text : x)),
                            });
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "AI failed");
                          }
                        }}
                      >
                        <Sparkles className="size-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          update(idx, { bullets: (it.bullets || []).filter((_, i) => i !== bi) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" className="gap-1.5" onClick={() => addBullet(idx, it)}>
                  <Plus className="size-4" /> Add bullet
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <Label>Technologies (comma separated)</Label>
              <CommaListInput
                placeholder="e.g. Python, FastAPI, OpenAI"
                value={it.technologies || []}
                onChange={(technologies) => update(idx, { technologies })}
              />
            </div>
          </Card>
        )}
      </SortableList>
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => setField("projects", [...items, { id: uid(), name: "", link: "", description: "", bullets: [], technologies: [] }])}
      >
        <Plus className="size-4" /> Add project
      </Button>
    </div>
  );
}

function SkillsEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const items = data.skills || [];
  const ai = useAiSuggestSkills();
  const [role, setRole] = useState("");
  function update(idx: number, patch: Partial<SkillGroup>) {
    setField("skills", items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      <Card className="p-4 bg-card border-card-border">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <Label>Suggest skills for role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend Engineer" className="mt-1" />
          </div>
          <Button
            disabled={ai.isPending || !role}
            className="gap-1.5"
            onClick={async () => {
              try {
                const out = await ai.mutateAsync({
                  data: {
                    role,
                    existing: items.flatMap((g) => g.items || []),
                  },
                });
                const merged: SkillGroup[] = items.length
                  ? items
                  : [{ id: uid(), category: "Skills", items: [] }];
                merged[0] = { ...merged[0], items: Array.from(new Set([...(merged[0].items || []), ...out.skills])) };
                setField("skills", merged);
                toast.success(`${out.skills.length} skills suggested`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "AI failed");
              }
            }}
          >
            <Sparkles className="size-4" /> Suggest with AI
          </Button>
        </div>
      </Card>
      <SortableList items={items} onReorder={(v) => setField("skills", v)}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">Group {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setField("skills", items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FormField label="Category" value={it.category} onChange={(v) => update(idx, { category: v })} />
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5 mb-0.5"
                disabled={ai.isPending || !it.category}
                onClick={async () => {
                  try {
                    const out = await ai.mutateAsync({
                      data: {
                        role: it.category || "",
                        existing: items.flatMap((g) => g.items || []),
                      },
                    });
                    const newItems = Array.from(new Set([...(it.items || []), ...out.skills]));
                    update(idx, { items: newItems });
                    toast.success(`${out.skills.length} skills suggested for "${it.category}"`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "AI failed");
                  }
                }}
              >
                <Sparkles className="size-4" /> Suggest
              </Button>
            </div>
            <div className="mt-2">
              <Label>Skills (comma separated)</Label>
              <CommaListInput
                value={it.items || []}
                onChange={(items) => update(idx, { items })}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(it.items || []).map((s, i) => (
                  <Badge key={i} variant="secondary">{s}</Badge>
                ))}
              </div>
            </div>
          </Card>
        )}
      </SortableList>
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => setField("skills", [...items, { id: uid(), category: "Skills", items: [] }])}
      >
        <Plus className="size-4" /> Add skill group
      </Button>
    </div>
  );
}

function SimpleEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: SimpleItem[];
  onChange: (v: SimpleItem[]) => void;
}) {
  function update(idx: number, patch: Partial<SimpleItem>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      <SortableList items={items} onReorder={onChange}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">{label} {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Row>
              <FormField label="Title" value={it.title} onChange={(v) => update(idx, { title: v })} />
              <FormField label="Subtitle" value={it.subtitle} onChange={(v) => update(idx, { subtitle: v })} />
            </Row>
            <Row>
              <FormField label="Date" value={it.date} onChange={(v) => update(idx, { date: v })} />
              <div />
            </Row>
            <div className="space-y-1 mt-2">
              <Label>Description</Label>
              <Textarea rows={2} value={it.description || ""} onChange={(e) => update(idx, { description: e.target.value })} />
            </div>
          </Card>
        )}
      </SortableList>
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => onChange([...items, { id: uid(), title: "", subtitle: "", date: "", description: "" }])}
      >
        <Plus className="size-4" /> Add {label.toLowerCase()}
      </Button>
    </div>
  );
}

function LanguagesEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const items = data.languages || [];
  function update(idx: number, patch: Partial<LanguageItem>) {
    setField("languages", items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      <SortableList items={items} onReorder={(v) => setField("languages", v)}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">Language {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setField("languages", items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <Row>
              <FormField label="Language" value={it.name} onChange={(v) => update(idx, { name: v })} />
              <FormField label="Level" value={it.level} onChange={(v) => update(idx, { level: v })} />
            </Row>
          </Card>
        )}
      </SortableList>
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => setField("languages", [...items, { id: uid(), name: "", level: "" }])}
      >
        <Plus className="size-4" /> Add language
      </Button>
    </div>
  );
}

function CustomEditor({ data, setField }: { data: ResumeData; setField: <K extends keyof ResumeData>(k: K, v: ResumeData[K]) => void }) {
  const items = data.custom || [];
  function update(idx: number, patch: Partial<CustomSection>) {
    setField("custom", items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  return (
    <div className="space-y-3">
      <SortableList items={items} onReorder={(v) => setField("custom", v)}>
        {(it, idx, handle) => (
          <Card className="p-4 mb-3 bg-card border-card-border">
            <div className="flex items-center gap-2 mb-3">
              {handle}
              <span className="text-xs text-muted-foreground">Section {idx + 1}</span>
              <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setField("custom", items.filter((_, i) => i !== idx))}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            <FormField label="Section title" value={it.title} onChange={(v) => update(idx, { title: v })} />
            <div className="mt-3">
              <Label>Items</Label>
              <SimpleEditor
                label="Item"
                items={it.items || []}
                onChange={(v) => update(idx, { items: v })}
              />
            </div>
          </Card>
        )}
      </SortableList>
      <Button
        variant="outline"
        className="w-full gap-1.5"
        onClick={() => setField("custom", [...items, { id: uid(), title: "Custom", items: [] }])}
      >
        <Plus className="size-4" /> Add custom section
      </Button>
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onLoaded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLoaded: (d: Partial<ResumeData>) => void;
}) {
  const [text, setText] = useState("");
  const [fileLabel, setFileLabel] = useState<string>("");
  const [stage, setStage] = useState<"idle" | "extracting" | "parsing">("idle");
  const parse = useAiParseResume();

  async function handleFile(f: File) {
    setStage("extracting");
    setFileLabel(`${f.name} (${formatBytes(f.size)})`);
    try {
      if (f.name.toLowerCase().endsWith(".json")) {
        const txt = await f.text();
        const obj = JSON.parse(txt) as Partial<ResumeData>;
        onLoaded(obj);
        toast.success("Imported from JSON");
        onOpenChange(false);
        return;
      }
      const extracted = await extractTextFromFile(f);
      if (!extracted.trim()) {
        toast.error("Could not extract any text from the file. Try pasting it instead.");
        setStage("idle");
        return;
      }
      setText(extracted);
      await runAiParse(extracted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStage("idle");
    }
  }

  async function runAiParse(raw: string) {
    setStage("parsing");
    try {
      const out = await parse.mutateAsync({ data: { text: raw } });
      const parsed = (out as { data: Partial<ResumeData> }).data || {};
      const cleaned = pruneEmpty(parsed);
      if (Object.keys(cleaned).length === 0) {
        toast.error("AI parser returned no fields. Try with cleaner text.");
        setStage("idle");
        return;
      }
      onLoaded(cleaned);
      toast.success("Resume imported and parsed");
      onOpenChange(false);
      setText("");
      setFileLabel("");
      setStage("idle");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI parse failed");
      setStage("idle");
    }
  }

  const busy = stage !== "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import an existing resume</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Upload PDF, DOCX, or JSON</Label>
            <div className="mt-1.5">
              <label
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition ${
                  busy ? "opacity-60 pointer-events-none" : "hover:bg-muted/40 hover:border-primary/40"
                }`}
              >
                <Upload className="size-6 text-muted-foreground" />
                <div className="text-sm font-medium">
                  {fileLabel || "Click to upload — PDF, DOCX, or JSON"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Every section is extracted with AI: contact, experience, education, projects, skills, and more.
                </div>
                <input
                  type="file"
                  accept=".json,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {stage === "extracting" ? "Extracting text…" : "Parsing with AI…"}
            </div>
          )}

          <div>
            <Label>Or paste resume text</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="mt-1 font-mono text-xs"
              placeholder="Paste the full text of your resume here…"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={!text.trim() || busy}
            onClick={() => {
              onLoaded({ summary: text.trim() });
              toast.success("Added to summary");
              onOpenChange(false);
              setText("");
            }}
          >
            Just add to summary
          </Button>
          <Button
            disabled={!text.trim() || busy}
            onClick={() => runAiParse(text.trim())}
            className="gap-1.5"
          >
            <Sparkles className="size-4" />
            {stage === "parsing" ? "Parsing…" : "Parse with AI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pruneEmpty(d: Partial<ResumeData>): Partial<ResumeData> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      const inner = Object.entries(v as Record<string, unknown>).filter(
        ([, x]) => x !== undefined && x !== null && x !== "",
      );
      if (inner.length === 0) continue;
    }
    out[k] = v;
  }
  return out as Partial<ResumeData>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function AtsScoreDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (v: boolean) => void; data: ResumeData }) {
  const score = useAiAtsScore();
  const [job, setJob] = useState("");
  const [result, setResult] = useState<{ score: number; strengths: string[]; improvements: string[] } | null>(null);

  const tone = useMemo(() => {
    const s = result?.score ?? 0;
    if (s >= 80) return "text-emerald-600";
    if (s >= 60) return "text-amber-600";
    return "text-destructive";
  }, [result]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ATS Score</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Job description (optional)</Label>
          <Textarea rows={4} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste a job description for a tailored score." />
          <Button
            disabled={score.isPending}
            className="gap-1.5"
            onClick={async () => {
              try {
                const out = await score.mutateAsync({ data: { resume: data, jobDescription: job || undefined } });
                setResult(out);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            <Sparkles className="size-4" /> {score.isPending ? "Analyzing…" : "Analyze"}
          </Button>
          {result && (
            <div className="pt-2">
              <div className={`text-5xl font-bold ${tone}`}>{result.score}<span className="text-base text-muted-foreground">/100</span></div>
              <div className="mt-4">
                <div className="text-sm font-semibold">Strengths</div>
                <ul className="list-disc ml-5 text-sm space-y-1 mt-1">
                  {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold">Improvements</div>
                <ul className="list-disc ml-5 text-sm space-y-1 mt-1">
                  {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
