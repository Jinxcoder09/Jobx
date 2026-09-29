// ─── Domain types (inlined from @workspace/api-zod / @workspace/api-client-react) ──

export interface PersonalInfo {
  fullName?: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  photoUrl?: string;
}

export interface ExperienceItem {
  id?: string;
  company?: string;
  role?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets?: string[];
}

export interface EducationItem {
  id?: string;
  school?: string;
  degree?: string;
  field?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
  description?: string;
}

export interface ProjectItem {
  id?: string;
  name?: string;
  link?: string;
  description?: string;
  bullets?: string[];
  technologies?: string[];
}

export interface SkillGroup {
  id?: string;
  category?: string;
  items?: string[];
}

export interface SimpleItem {
  id?: string;
  title?: string;
  subtitle?: string;
  date?: string;
  description?: string;
}

export interface LanguageItem {
  id?: string;
  name?: string;
  level?: string;
}

export interface CustomSection {
  id?: string;
  title?: string;
  items?: SimpleItem[];
}

export interface ResumeData {
  personal?: PersonalInfo;
  summary?: string;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  projects?: ProjectItem[];
  skills?: SkillGroup[];
  certifications?: SimpleItem[];
  achievements?: SimpleItem[];
  languages?: LanguageItem[];
  custom?: CustomSection[];
  sectionOrder?: string[];
}

export interface Theme {
  fontFamily?: string;
  fontSize?: number;
  lineSpacing?: number;
  sectionSpacing?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  layout?: "single" | "two-column";
}

// ─── Resume serialisation ────────────────────────────────────────────────────
// Data can arrive from imported JSON as well as UI state. Build a fresh, known
// shape before sending it to the API so a browser event/DOM object can never be
// persisted or passed to JSON.stringify.

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordList(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function simpleItem(value: UnknownRecord): SimpleItem {
  return {
    id: stringValue(value.id),
    title: stringValue(value.title),
    subtitle: stringValue(value.subtitle),
    date: stringValue(value.date),
    description: stringValue(value.description),
  };
}

/**
 * Returns a JSON-safe copy containing only the supported resume fields.
 *
 * This is intentionally a whitelist rather than a generic deep clone: React
 * events and DOM nodes contain circular references, while valid resume data
 * consists solely of strings, booleans, arrays, and plain objects.
 */
export function sanitizeResumeData(value: unknown): ResumeData {
  const data = isRecord(value) ? value : {};
  const personal = isRecord(data.personal) ? data.personal : {};

  return {
    personal: {
      fullName: stringValue(personal.fullName),
      title: stringValue(personal.title),
      email: stringValue(personal.email),
      phone: stringValue(personal.phone),
      location: stringValue(personal.location),
      website: stringValue(personal.website),
      linkedin: stringValue(personal.linkedin),
      github: stringValue(personal.github),
      photoUrl: stringValue(personal.photoUrl),
    },
    summary: stringValue(data.summary),
    experience: recordList(data.experience).map((item) => ({
      id: stringValue(item.id),
      company: stringValue(item.company),
      role: stringValue(item.role),
      location: stringValue(item.location),
      startDate: stringValue(item.startDate),
      endDate: stringValue(item.endDate),
      current: item.current === true,
      bullets: stringList(item.bullets),
    })),
    education: recordList(data.education).map((item) => ({
      id: stringValue(item.id),
      school: stringValue(item.school),
      degree: stringValue(item.degree),
      field: stringValue(item.field),
      location: stringValue(item.location),
      startDate: stringValue(item.startDate),
      endDate: stringValue(item.endDate),
      gpa: stringValue(item.gpa),
      description: stringValue(item.description),
    })),
    projects: recordList(data.projects).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name),
      link: stringValue(item.link),
      description: stringValue(item.description),
      bullets: stringList(item.bullets),
      technologies: stringList(item.technologies),
    })),
    skills: recordList(data.skills).map((item) => ({
      id: stringValue(item.id),
      category: stringValue(item.category),
      items: stringList(item.items),
    })),
    certifications: recordList(data.certifications).map(simpleItem),
    achievements: recordList(data.achievements).map(simpleItem),
    languages: recordList(data.languages).map((item) => ({
      id: stringValue(item.id),
      name: stringValue(item.name),
      level: stringValue(item.level),
    })),
    custom: recordList(data.custom).map((section) => ({
      id: stringValue(section.id),
      title: stringValue(section.title),
      items: recordList(section.items).map(simpleItem),
    })),
    sectionOrder: stringList(data.sectionOrder),
  };
}

// ─── Resume top-level ─────────────────────────────────────────────────────────

export interface Resume {
  id: string;
  title: string;
  templateId: string;
  theme: Theme;
  data: ResumeData;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  templateId: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  layout: "single" | "two-column";
  accentColor: string;
  fontFamily: string;
  preview?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SECTION_KEYS = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "achievements",
  "languages",
] as const;

export const SECTION_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  achievements: "Achievements",
  languages: "Languages",
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const FONT_OPTIONS = [
  "Inter",
  "Roboto",
  "Source Sans 3",
  "IBM Plex Sans",
  "Georgia",
  "Source Serif Pro",
  "Merriweather",
  "Lora",
  "JetBrains Mono",
];

export function deduplicateSectionOrder(order: string[]): string[] {
  if (!Array.isArray(order)) return order;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of order) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
