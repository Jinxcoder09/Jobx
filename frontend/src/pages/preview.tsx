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
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
    return;
  }, [data]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleResize() {
      if (!el) return;
      const w = el.offsetWidth;
      if (w > 0) {
        setZoom(Math.min(1, w / 816));
      }
    }
    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  if (!data) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }
  return (
    <div ref={containerRef} className="bg-white min-h-screen py-6 px-4 flex justify-center items-start overflow-hidden">
      <ResumeRender resume={data} zoom={zoom} showPageGuides={true} />
    </div>
  );
}

