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
