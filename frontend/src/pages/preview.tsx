import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useGetResume, getGetResumeQueryKey } from "@/lib/api";
import { ResumeRender } from "@/templates/Render";

export default function Preview() {
  const { id } = useParams<{ id: string }>();
  const { data } = useGetResume(id, {
    query: { enabled: !!id, queryKey: getGetResumeQueryKey(id) },
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const s = Math.min(1, (w - 32) / 816);
        setScale(s);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [data]);

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return;
  }, [data]);

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }
  return (
    <div className="bg-white min-h-screen py-6 px-4 flex justify-center items-start overflow-x-hidden" ref={containerRef}>
      <ResumeRender resume={data} zoom={scale} showPageGuides={true} />
    </div>
  );
}
