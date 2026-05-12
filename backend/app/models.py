from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# ─── Resume sub-models ────────────────────────────────────────────────────────

class PersonalInfo(BaseModel):
    fullName: str = ""
    title: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    website: str = ""
    linkedin: str = ""
    github: str = ""
    photoUrl: str = ""


class ExperienceItem(BaseModel):
    id: str = ""
    company: str = ""
    role: str = ""
    location: str = ""
    startDate: str = ""
    endDate: str = ""
    current: bool = False
    bullets: list[str] = Field(default_factory=list)


class EducationItem(BaseModel):
    id: str = ""
    school: str = ""
    degree: str = ""
    field: str = ""
    location: str = ""
    startDate: str = ""
    endDate: str = ""
    gpa: str = ""
    description: str = ""


class ProjectItem(BaseModel):
    id: str = ""
    name: str = ""
    link: str = ""
    description: str = ""
    bullets: list[str] = Field(default_factory=list)
    technologies: list[str] = Field(default_factory=list)


class SkillGroup(BaseModel):
    id: str = ""
    category: str = ""
    items: list[str] = Field(default_factory=list)


class SimpleItem(BaseModel):
    id: str = ""
    title: str = ""
    subtitle: str = ""
    date: str = ""
    description: str = ""


class LanguageItem(BaseModel):
    id: str = ""
    name: str = ""
    level: str = ""


class CustomSection(BaseModel):
    id: str = ""
    title: str = ""
    items: list[SimpleItem] = Field(default_factory=list)


class ResumeData(BaseModel):
    personal: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: str = ""
    experience: list[ExperienceItem] = Field(default_factory=list)
    education: list[EducationItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    skills: list[SkillGroup] = Field(default_factory=list)
    certifications: list[SimpleItem] = Field(default_factory=list)
    achievements: list[SimpleItem] = Field(default_factory=list)
    languages: list[LanguageItem] = Field(default_factory=list)
    custom: list[CustomSection] = Field(default_factory=list)
    sectionOrder: list[str] = Field(
        default_factory=lambda: [
            "summary", "experience", "education", "projects",
            "skills", "certifications", "achievements", "languages",
        ]
    )


class Theme(BaseModel):
    fontFamily: str = "Inter"
    fontSize: int = 11
    lineSpacing: float = 1.4
    sectionSpacing: int = 16
    primaryColor: str = "#0f172a"
    secondaryColor: str = "#475569"
    accentColor: str = "#2563eb"
    layout: Literal["single", "two-column"] = "single"


# ─── Resume top-level ─────────────────────────────────────────────────────────

class Resume(BaseModel):
    id: str
    title: str
    templateId: str
    theme: Theme
    data: ResumeData
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class ResumeSummary(BaseModel):
    id: str
    title: str
    templateId: str
    updatedAt: Optional[str] = None


# ─── Request / Response bodies ────────────────────────────────────────────────

class CreateResumeInput(BaseModel):
    title: str
    templateId: str


class UpdateResumeInput(BaseModel):
    title: Optional[str] = None
    templateId: Optional[str] = None
    theme: Optional[Theme] = None
    data: Optional[ResumeData] = None


class DeleteResult(BaseModel):
    success: bool


class HealthStatus(BaseModel):
    status: str = "ok"


# ─── AI request bodies ────────────────────────────────────────────────────────

class AiSummaryRequest(BaseModel):
    role: str
    experience: Optional[str] = None
    skills: Optional[str] = None
    tone: Optional[str] = None


class AiImproveRequest(BaseModel):
    text: str
    context: Optional[str] = None


class AiSkillsRequest(BaseModel):
    role: str
    existing: Optional[list[str]] = None


class AiGrammarRequest(BaseModel):
    text: str


class AiScoreRequest(BaseModel):
    resume: Optional[dict[str, Any]] = None
    jobDescription: Optional[str] = None


class AiParseRequest(BaseModel):
    text: str


# ─── AI response bodies ───────────────────────────────────────────────────────

class AiTextResponse(BaseModel):
    text: str


class AiSkillsResponse(BaseModel):
    skills: list[str]


class AiScoreResponse(BaseModel):
    score: int
    strengths: list[str]
    improvements: list[str]


class AiParseResponse(BaseModel):
    data: dict[str, Any]


# ─── Template ─────────────────────────────────────────────────────────────────

class Template(BaseModel):
    id: str
    name: str
    description: str
    category: str
    layout: Literal["single", "two-column"]
    accentColor: str
    fontFamily: str
    preview: Optional[str] = None
