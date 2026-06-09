import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListResumes,
  getListResumesQueryKey,
  useCreateResume,
  useDeleteResume,
  useListTemplates,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { data, isLoading } = useListResumes();
  const { data: templates } = useListTemplates();
  const qc = useQueryClient();
  const create = useCreateResume();
  const del = useDeleteResume();
  const [, setLoc] = useLocation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Untitled Resume");
  const [templateId, setTemplateId] = useState("modern");

  async function onCreate() {
    try {
      const res = await create.mutateAsync({ data: { title: title || "Untitled Resume", templateId } });
      qc.invalidateQueries({ queryKey: getListResumesQueryKey() });
      setOpen(false);
      setLoc(`/builder/${res.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create resume");
    }
  }

  async function onDelete(id: string) {
    try {
      await del.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListResumesQueryKey() });
      toast.success("Resume deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your resumes</h1>
            <p className="text-muted-foreground mt-1">
              Beautiful, ATS-friendly resumes built with AI assistance.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> New resume
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new resume</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior PM Resume" />
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-auto">
                    {templates?.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTemplateId(t.id)}
                        className={`text-left p-3 rounded-md border hover-elevate ${templateId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                      >
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={onCreate} disabled={create.isPending}>
                  {create.isPending ? "Creating..." : "Create resume"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <Card className="p-12 text-center bg-card border border-card-border">
            <div className="mx-auto size-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <FileText className="size-6 text-accent" />
            </div>
            <h3 className="text-lg font-semibold">No resumes yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">
              Pick a template and start building in minutes.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="size-4" /> Create your first resume
            </Button>
          </Card>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="group p-5 pr-12 bg-card border-card-border hover-elevate relative">
                  <Link href={`/builder/${r.id}`} className="block">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {r.templateId}
                    </div>
                    <div className="mt-1 font-semibold text-lg">{r.title}</div>
                    {r.updatedAt && (
                      <div className="text-xs text-muted-foreground mt-3">
                        Updated {new Date(r.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      onDelete(r.id!);
                    }}
                    aria-label="Delete resume"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
