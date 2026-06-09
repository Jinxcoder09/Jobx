import { useEffect } from "react";
import { useParams } from "wouter";
import { useGetResume, getGetResumeQueryKey } from "@/lib/api";
import { ResumeRender } from "@/templates/Render";

export default function Preview() {
  const { id } = useParams<{ id: string }>();
  const { data } = useGetResume(id, {
    query: { enabled: !!id, queryKey: getGetResumeQueryKey(id) },
  });

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
    <div className="bg-white min-h-screen py-6">
      <ResumeRender resume={data} showPageGuides={true} />
    </div>
  );
}
