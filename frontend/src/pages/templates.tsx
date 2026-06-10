import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTemplates,
  useCreateResume,
  getListResumesQueryKey,
} from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResumeRender } from "@/templates/Render";
import { sampleData, defaultTheme } from "@/lib/defaults";
import { motion } from "framer-motion";
import { toast } from "sonner";

function TemplateItemCard({
  template,
  onUse,
  createPending,
}: {
  template: { id: string; name: string; accentColor: string; fontFamily: string; layout: string; category?: string; description?: string };
  onUse: (t: any) => void;
  createPending: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width || 0);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const zoom = useMemo(() => {
    if (width <= 0) return 0.32;
    return width / 816;
  }, [width]);

  const previewResume = useMemo(
    () => ({
      id: "preview",
      title: template.name,
      templateId: template.id,
      theme: {
        ...defaultTheme(),
        accentColor: template.accentColor,
        fontFamily: template.fontFamily,
        layout: template.layout as "single" | "two-column",
      },
      data: sampleData(),
    }),
    [template],
  );

  return (
    <Card className="overflow-hidden bg-card border-card-border hover-elevate p-0 group">
      <div
        ref={containerRef}
        className="relative bg-muted overflow-hidden"
        style={{ height: 280 }}
        aria-hidden
      >
        <ResumeRender resume={previewResume as never} zoom={zoom} />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{template.name}</div>
            <div className="text-xs text-muted-foreground">{template.category}</div>
          </div>
          <span
            className="inline-block size-3 rounded-full"
            style={{ background: template.accentColor }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2 mb-4">{template.description}</p>
        <Button onClick={() => onUse(template)} disabled={createPending} className="w-full">
          Use template
        </Button>
      </div>
    </Card>
  );
}

export default function Templates() {
  const { data } = useListTemplates();
  const create = useCreateResume();
  const qc = useQueryClient();
  const [, setLoc] = useLocation();

  async function use(t: { id: string; name: string; accentColor: string; fontFamily: string; layout: string }) {
    try {
      const res = await create.mutateAsync({
        data: { title: `${t.name} Resume`, templateId: t.id },
      });
      qc.invalidateQueries({ queryKey: getListResumesQueryKey() });
      setLoc(`/builder/${res.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    }
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Twelve hand-crafted, ATS-friendly templates. Pick one to start.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <TemplateItemCard template={t} onUse={use} createPending={create.isPending} />
            </motion.div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
