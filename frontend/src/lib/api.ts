/**
 * api.ts — drop-in replacement for @workspace/api-client-react
 *
 * Provides the same React Query hooks and query-key helpers that the
 * original generated client exposed, now pointing at the FastAPI backend.
 */
import {
  useQuery,
  useMutation,
  type UseQueryResult,
  type UseMutationResult,
  type QueryKey,
} from "@tanstack/react-query";

import {
  sanitizeResumeData,
  type Resume,
  type ResumeSummary,
  type Template,
  type Theme,
  type ResumeData,
} from "./types";

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Vite exposes VITE_API_URL at build time; falls back to same-origin /api
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type ApiErrorDetail = {
  loc?: unknown;
  msg?: unknown;
};

function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const payload = body as { error?: unknown; detail?: unknown };
  if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
  if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;

  // FastAPI validation errors contain a detail array. Rendering that array
  // directly produces "[object Object]" and hides the actual invalid field.
  if (Array.isArray(payload.detail)) {
    const messages = payload.detail
      .filter((detail): detail is ApiErrorDetail => Boolean(detail) && typeof detail === "object")
      .map((detail) => {
        const location = Array.isArray(detail.loc)
          ? detail.loc
              .filter((part): part is string | number => typeof part === "string" || typeof part === "number")
              .filter((part) => part !== "body")
              .join(".")
          : "";
        const message = typeof detail.msg === "string" ? detail.msg : "Invalid value";
        return location ? `${location}: ${message}` : message;
      })
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  return fallback;
}

async function errorFromResponse(res: Response): Promise<Error> {
  const body: unknown = await res.json().catch(() => undefined);
  return new Error(apiErrorMessage(body, `HTTP ${res.status}`));
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) throw await errorFromResponse(res);
  return res.json() as Promise<T>;
}

// ─── Document Export ──────────────────────────────────────────────────────────

export async function downloadDocument(
  endpoint: string,
  resume: Resume,
  extension: string
): Promise<void> {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resume),
  });
  if (!res.ok) throw await errorFromResponse(res);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${resume.title || "resume"}.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportResumeAsPdf(resume: Resume): Promise<void> {
  const pages = Array.from(document.querySelectorAll(".resume-page"));
  if (pages.length === 0) {
    return downloadDocument("/api/resume/generate-pdf", resume, "pdf");
  }

  const css = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch (e) {
        return "";
      }
    })
    .join("\n");

  const html = pages
    .map((p) => {
      const clone = p.cloneNode(true) as HTMLElement;
      const style = clone.style as any;
      style.webkitPrintColorAdjust = "exact";
      style.printColorAdjust = "exact";
      return clone.outerHTML;
    })
    .join("\n");

  const res = await fetch(`${BASE}/api/resume/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      css,
      title: resume.title || "resume",
    }),
  });

  if (!res.ok) throw await errorFromResponse(res);

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${resume.title || "resume"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function exportResumeAsDocx(resume: Resume): Promise<void> {
  return downloadDocument("/api/resume/generate-docx", resume, "docx");
}


// ─── Query key factories ──────────────────────────────────────────────────────

export const getListResumesQueryKey   = ()         => ["/api/resumes"]          as const;
export const getGetResumeQueryKey     = (id: string) => ["/api/resumes", id]     as const;
export const getListTemplatesQueryKey = ()         => ["/api/templates"]         as const;

// ─── Resumes ──────────────────────────────────────────────────────────────────

export function useListResumes(): UseQueryResult<ResumeSummary[], Error> & { queryKey: QueryKey } {
  const queryKey = getListResumesQueryKey();
  const query = useQuery<ResumeSummary[], Error>({
    queryKey,
    queryFn: () => apiFetch<ResumeSummary[]>("/api/resumes"),
  });
  return { ...query, queryKey };
}

export function useGetResume(
  id: string,
  options?: { query?: { enabled?: boolean; queryKey?: QueryKey } },
): UseQueryResult<Resume, Error> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetResumeQueryKey(id);
  const query = useQuery<Resume, Error>({
    queryKey,
    queryFn: () => apiFetch<Resume>(`/api/resumes/${id}`),
    enabled: options?.query?.enabled ?? !!id,
  });
  return { ...query, queryKey };
}

export function useCreateResume(): UseMutationResult<
  Resume,
  Error,
  { data: { title: string; templateId: string } }
> {
  return useMutation<Resume, Error, { data: { title: string; templateId: string } }>({
    mutationFn: ({ data }) =>
      apiFetch<Resume>("/api/resumes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useUpdateResume(): UseMutationResult<
  Resume,
  Error,
  { id: string; data: { title?: string; templateId?: string; theme?: Theme; data?: ResumeData } }
> {
  return useMutation<
    Resume,
    Error,
    { id: string; data: { title?: string; templateId?: string; theme?: Theme; data?: ResumeData } }
  >({
    mutationFn: ({ id, data }) =>
      apiFetch<Resume>(`/api/resumes/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
  });
}

export function useDeleteResume(): UseMutationResult<
  { success: boolean },
  Error,
  { id: string }
> {
  return useMutation<{ success: boolean }, Error, { id: string }>({
    mutationFn: ({ id }) =>
      apiFetch<{ success: boolean }>(`/api/resumes/${id}`, { method: "DELETE" }),
  });
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function useListTemplates(): UseQueryResult<Template[], Error> & { queryKey: QueryKey } {
  const queryKey = getListTemplatesQueryKey();
  const query = useQuery<Template[], Error>({
    queryKey,
    queryFn: () => apiFetch<Template[]>("/api/templates"),
    staleTime: Infinity, // templates are static
  });
  return { ...query, queryKey };
}

// ─── AI mutations ─────────────────────────────────────────────────────────────

export function useAiGenerateSummary(): UseMutationResult<
  { text: string },
  Error,
  { data: { role: string; experience?: string; skills?: string; tone?: string } }
> {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch<{ text: string }>("/api/ai/summary", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useAiImproveBullet(): UseMutationResult<
  { text: string },
  Error,
  { data: { text: string; context?: string } }
> {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch<{ text: string }>("/api/ai/improve", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useAiSuggestSkills(): UseMutationResult<
  { skills: string[] },
  Error,
  { data: { role: string; existing?: string[] } }
> {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch<{ skills: string[] }>("/api/ai/skills", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useAiFixGrammar(): UseMutationResult<
  { text: string },
  Error,
  { data: { text: string } }
> {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch<{ text: string }>("/api/ai/grammar", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useAiAtsScore(): UseMutationResult<
  { score: number; strengths: string[]; improvements: string[] },
  Error,
  { data: { resume?: ResumeData; jobDescription?: string } }
> {
  return useMutation({
    mutationFn: ({ data }) => {
      // Never stringify UI state directly. Imported/corrupted state can contain
      // a React event or DOM node, both of which carry circular references.
      const payload = {
        resume: sanitizeResumeData(data.resume),
        jobDescription: typeof data.jobDescription === "string" ? data.jobDescription : undefined,
      };
      return apiFetch<{ score: number; strengths: string[]; improvements: string[] }>(
        "/api/ai/score",
        { method: "POST", body: JSON.stringify(payload) },
      );
    },
  });
}

export function useAiParseResume(): UseMutationResult<
  { data: Record<string, unknown> },
  Error,
  { data: { text: string } }
> {
  return useMutation({
    mutationFn: ({ data }) =>
      apiFetch<{ data: Record<string, unknown> }>("/api/ai/parse", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

// ─── Re-export types for convenience (mirrors @workspace/api-client-react) ───
export type {
  Resume,
  ResumeSummary,
  ResumeData,
  Theme,
  Template,
  PersonalInfo,
  ExperienceItem,
  EducationItem,
  ProjectItem,
  SkillGroup,
  SimpleItem,
  LanguageItem,
  CustomSection,
} from "./types";
