"""
AI endpoints — exact functional port of the TypeScript Express ai.ts route.

All prompts, fallback logic, heuristic scoring, and JSON-extraction behaviour
are preserved 1-to-1.  Only the runtime (Python/FastAPI) and the AI client
(OpenAI SDK → Groq) changed.
"""
from __future__ import annotations
import logging
import random
import string
from typing import Any

from fastapi import APIRouter

from ..groq_client import groq_chat, extract_json
from ..models import (
    AiBulletsRequest,
    AiBulletsResponse,
    AiGrammarRequest,
    AiImproveRequest,
    AiParseRequest,
    AiParseResponse,
    AiScoreRequest,
    AiScoreResponse,
    AiSkillsRequest,
    AiSkillsResponse,
    AiSummaryRequest,
    AiTextResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _uid(prefix: str) -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"{prefix}_{suffix}"


def _str(v: Any) -> str:
    return v if isinstance(v, str) else ""


def _arr(v: Any) -> list:
    return v if isinstance(v, list) else []


def _obj(v: Any) -> dict:
    return v if isinstance(v, dict) else {}


def _str_arr(v: Any) -> list[str]:
    return [s.strip() for s in _arr(v) if isinstance(s, str) and s.strip()]


# ─── /ai/summary ─────────────────────────────────────────────────────────────

@router.post("/ai/summary", response_model=AiTextResponse)
async def ai_generate_summary(body: AiSummaryRequest) -> dict:
    text = await groq_chat(
        [
            {
                "role": "system",
                "content": (
                    "You write concise, ATS-optimized resume summaries "
                    "(2-4 sentences, third person omitted, no clichés, strong verbs)."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Role: {body.role}\n"
                    f"Experience: {body.experience or ''}\n"
                    f"Key skills: {body.skills or ''}\n"
                    f"Tone: {body.tone or 'professional'}\n\n"
                    "Write the summary only — no preface."
                ),
            },
        ],
        temperature=0.7,
        max_tokens=220,
    )
    return {"text": text}


# ─── /ai/improve ─────────────────────────────────────────────────────────────

@router.post("/ai/improve", response_model=AiTextResponse)
async def ai_improve_bullet(body: AiImproveRequest) -> dict:
    text = await groq_chat(
        [
            {
                "role": "system",
                "content": (
                    "You are a resume bullet point generator. Given a rough description "
                    "or query, generate a polished resume bullet point. Lead with a strong "
                    "action verb, quantify impact when reasonable, keep under 22 words, "
                    "no first person, no buzzwords. Return only the bullet point, no preface."
                ),
            },
            {
                "role": "user",
                "content": f"Context: {body.context or 'general'}\nDescription: {body.text}",
            },
        ],
        temperature=0.5,
        max_tokens=120,
    )
    return {"text": text}


# ─── /ai/bullets ─────────────────────────────────────────────────────────────

@router.post("/ai/bullets", response_model=AiBulletsResponse)
async def ai_generate_bullets(body: AiBulletsRequest) -> dict:
    parts = []
    if body.role:
        parts.append(f"Role: {body.role}")
    if body.company:
        parts.append(f"Company: {body.company}")
    if body.description:
        parts.append(f"Description: {body.description}")
    if body.technologies:
        parts.append(f"Technologies: {', '.join(body.technologies)}")

    context_str = "\n".join(parts) if parts else "General experience"

    raw = await groq_chat(
        [
            {
                "role": "system",
                "content": (
                    f"Generate {body.count or 4} resume bullet points. "
                    "Each bullet: lead with a strong action verb, quantify impact, "
                    "keep under 22 words, no first person, no buzzwords. "
                    'Return STRICT JSON: {{"bullets":["bullet1","bullet2",...]}}'
                ),
            },
            {
                "role": "user",
                "content": (
                    f"{context_str}\n\n"
                    "Generate achievement-focused bullet points for this experience."
                ),
            },
        ],
        temperature=0.5,
        json_mode=True,
        max_tokens=600,
    )

    bullets: list[str] = []
    parsed = extract_json(raw)
    if parsed and isinstance(parsed.get("bullets"), list):
        bullets = [s.strip() for s in parsed["bullets"] if isinstance(s, str) and s.strip()]
    else:
        import re
        bullets = [
            re.sub(r'^[-*"\s]+|["\s]+$', "", s)
            for s in re.split(r"[,\n]", raw)
            if s.strip()
        ][:body.count or 4]

    return {"bullets": bullets}


# ─── /ai/skills ──────────────────────────────────────────────────────────────

@router.post("/ai/skills", response_model=AiSkillsResponse)
async def ai_suggest_skills(body: AiSkillsRequest) -> dict:
    existing = ", ".join(body.existing or [])
    raw = await groq_chat(
        [
            {
                "role": "system",
                "content": (
                    'Return STRICT JSON: {"skills":["skill",...]} with 10-15 '
                    "relevant skills for the given role or category. No commentary."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Role / Category: {body.role}\n"
                    f"Already listed: {existing}\n"
                    "Suggest relevant skills the user has likely missed."
                ),
            },
        ],
        temperature=0.4,
        json_mode=True,
        max_tokens=400,
    )

    skills: list[str] = []
    parsed = extract_json(raw)
    if parsed and isinstance(parsed.get("skills"), list):
        skills = [s.strip() for s in parsed["skills"] if isinstance(s, str) and s.strip()]
    else:
        import re
        skills = [
            re.sub(r'^[-*"\s]+|["\s]+$', "", s)
            for s in re.split(r"[,\n]", raw)
            if s.strip()
        ][:18]

    return {"skills": skills}


# ─── /ai/grammar ─────────────────────────────────────────────────────────────

@router.post("/ai/grammar", response_model=AiTextResponse)
async def ai_fix_grammar(body: AiGrammarRequest) -> dict:
    text = await groq_chat(
        [
            {
                "role": "system",
                "content": (
                    "Fix grammar, tone, and clarity for a professional resume. "
                    "Preserve meaning and length. Return only the corrected text."
                ),
            },
            {"role": "user", "content": body.text},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    return {"text": text}


# ─── /ai/score ───────────────────────────────────────────────────────────────

@router.post("/ai/score", response_model=AiScoreResponse)
async def ai_ats_score(body: AiScoreRequest) -> dict:
    import json

    resume_json = json.dumps(body.resume or {})[:6000]
    parsed: dict | None = None

    try:
        raw = await groq_chat(
            [
                {
                    "role": "system",
                    "content": (
                        'You are an ATS reviewer. Reply with one JSON object only, no markdown: '
                        '{"score": <0-100 integer>, "strengths": ["..."], "improvements": ["..."]}. '
                        "3-6 items per array. Be specific and actionable."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Resume JSON:\n{resume_json}\n\n"
                        f"Job description (optional):\n{body.jobDescription or ''}"
                    ),
                },
            ],
            temperature=0.3,
            json_mode=True,
            max_tokens=800,
        )
        parsed = extract_json(raw)
    except Exception as e:
        logger.warning("ATS Groq call failed, using heuristic: %s", e)

    if not parsed:
        return _heuristic_score(body.resume, body.jobDescription)

    score = parsed.get("score")
    score = (
        max(0, min(100, int(score)))
        if isinstance(score, (int, float))
        else _heuristic_score(body.resume).get("score", 50)
    )
    strengths = [s for s in _arr(parsed.get("strengths")) if isinstance(s, str)]
    improvements = [s for s in _arr(parsed.get("improvements")) if isinstance(s, str)]

    return {"score": score, "strengths": strengths, "improvements": improvements}


# ─── /ai/parse ───────────────────────────────────────────────────────────────

@router.post("/ai/parse", response_model=AiParseResponse)
async def ai_parse_resume(body: AiParseRequest) -> dict:
    text = body.text[:18000]
    parsed: dict | None = None

    try:
        raw = await groq_chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You convert raw resume text into a strict JSON object matching this schema "
                        "(omit empty fields, use empty arrays where appropriate):\n"
                        '{\n'
                        '  "personal": {"fullName": "", "title": "", "email": "", "phone": "", '
                        '"location": "", "website": "", "linkedin": "", "github": ""},\n'
                        '  "summary": "",\n'
                        '  "experience": [{"id":"","company":"","role":"","location":"","startDate":"",'
                        '"endDate":"","current":false,"bullets":[""]}],\n'
                        '  "education": [{"id":"","school":"","degree":"","field":"","location":"",'
                        '"startDate":"","endDate":"","gpa":"","description":""}],\n'
                        '  "projects": [{"id":"","name":"","link":"","description":"","bullets":[""],'
                        '"technologies":[""]}],\n'
                        '  "skills": [{"id":"","category":"","items":[""]}],\n'
                        '  "certifications": [{"id":"","title":"","subtitle":"","date":"","description":""}],\n'
                        '  "achievements": [{"id":"","title":"","subtitle":"","date":"","description":""}],\n'
                        '  "languages": [{"id":"","name":"","level":""}]\n'
                        "}\n"
                        "Reply with ONE JSON object only — no markdown, no commentary."
                    ),
                },
                {"role": "user", "content": f"Resume text:\n{text}"},
            ],
            temperature=0.2,
            json_mode=True,
            max_tokens=2200,
        )
        parsed = extract_json(raw)
    except Exception as e:
        logger.warning("Parse Groq call failed: %s", e)

    if not parsed or not isinstance(parsed, dict):
        return {"data": {"summary": text[:1000]}}

    return {"data": _normalize_parsed(parsed)}


# ─── Parse normalizer ─────────────────────────────────────────────────────────

def _normalize_parsed(inp: dict) -> dict:
    p = _obj(inp.get("personal"))
    return {
        "personal": {
            "fullName": _str(p.get("fullName") or p.get("name")),
            "title": _str(p.get("title")),
            "email": _str(p.get("email")),
            "phone": _str(p.get("phone")),
            "location": _str(p.get("location")),
            "website": _str(p.get("website")),
            "linkedin": _str(p.get("linkedin")),
            "github": _str(p.get("github")),
        },
        "summary": _str(inp.get("summary")),
        "experience": [
            {
                "id": _uid("e"),
                "company": _str(o.get("company")),
                "role": _str(o.get("role") or o.get("title")),
                "location": _str(o.get("location")),
                "startDate": _str(o.get("startDate") or o.get("start")),
                "endDate": _str(o.get("endDate") or o.get("end")),
                "current": bool(o.get("current")),
                "bullets": _str_arr(o.get("bullets") or o.get("highlights") or o.get("responsibilities")),
            }
            for e in _arr(inp.get("experience"))
            for o in [_obj(e)]
        ],
        "education": [
            {
                "id": _uid("ed"),
                "school": _str(o.get("school") or o.get("institution")),
                "degree": _str(o.get("degree")),
                "field": _str(o.get("field") or o.get("major")),
                "location": _str(o.get("location")),
                "startDate": _str(o.get("startDate") or o.get("start")),
                "endDate": _str(o.get("endDate") or o.get("end")),
                "gpa": _str(o.get("gpa")),
                "description": _str(o.get("description")),
            }
            for e in _arr(inp.get("education"))
            for o in [_obj(e)]
        ],
        "projects": [
            {
                "id": _uid("p"),
                "name": _str(o.get("name") or o.get("title")),
                "link": _str(o.get("link") or o.get("url")),
                "description": _str(o.get("description")),
                "bullets": _str_arr(o.get("bullets") or o.get("highlights")),
                "technologies": _str_arr(o.get("technologies") or o.get("tech") or o.get("stack")),
            }
            for e in _arr(inp.get("projects"))
            for o in [_obj(e)]
        ],
        "skills": [
            sg
            for e in _arr(inp.get("skills"))
            for o in [_obj(e)]
            for items in [_str_arr(o.get("items") or o.get("skills"))]
            if items
            for sg in [
                {
                    "id": _uid("s"),
                    "category": _str(o.get("category") or o.get("name")) or "Skills",
                    "items": items,
                }
            ]
        ],
        "certifications": [
            {
                "id": _uid("c"),
                "title": _str(o.get("title") or o.get("name")),
                "subtitle": _str(o.get("subtitle") or o.get("issuer")),
                "date": _str(o.get("date")),
                "description": _str(o.get("description")),
            }
            for e in _arr(inp.get("certifications"))
            for o in [_obj(e)]
        ],
        "achievements": [
            {
                "id": _uid("a"),
                "title": _str(o.get("title")),
                "subtitle": _str(o.get("subtitle")),
                "date": _str(o.get("date")),
                "description": _str(o.get("description")),
            }
            for e in _arr(inp.get("achievements"))
            for o in [_obj(e)]
        ],
        "languages": [
            {
                "id": _uid("l"),
                "name": _str(o.get("name") or o.get("language")),
                "level": _str(o.get("level") or o.get("proficiency")),
            }
            for e in _arr(inp.get("languages"))
            for o in [_obj(e)]
        ],
    }


# ─── Heuristic ATS score (same logic as TypeScript original) ─────────────────

_STOPWORDS = {
    "the","and","for","with","you","your","our","are","will","that","this","have",
    "has","from","into","not","but","any","all","can","who","what","when","why",
    "how","may","also","such","more","than","then","they","them","their","there",
    "here","its","one","two","three","work","working","experience","role","job",
    "position","team","teams","strong","ability","abilities","skills","skill",
    "required","preferred","etc","plus","using","use","used",
}


def _heuristic_score(
    resume: dict | None,
    jd: str | None = None,
) -> dict:
    import re, json

    r = resume or {}
    strengths: list[str] = []
    improvements: list[str] = []
    score = 40

    p = r.get("personal") or {}
    if p.get("fullName"):
        score += 4
        strengths.append("Clear contact header with full name.")
    else:
        improvements.append("Add your full name to the personal section.")
    if p.get("email"):
        score += 3
    else:
        improvements.append("Add a professional email so recruiters can reach you.")
    if p.get("phone"):
        score += 2
    else:
        improvements.append("Include a phone number for easy contact.")
    if p.get("title"):
        score += 3
        strengths.append("A target job title is set on the header.")
    else:
        improvements.append("Add a target job title under your name (e.g. 'Senior Engineer').")

    summary = r.get("summary") or ""
    if isinstance(summary, str) and len(summary) > 80:
        score += 6
        strengths.append("Summary is present and meaningfully developed.")
    else:
        improvements.append("Add a 2–4 sentence professional summary tailored to the role.")

    exp = r.get("experience") or []
    if len(exp) >= 2:
        score += 8
        strengths.append(f"{len(exp)} work experience entries listed.")
    elif len(exp) == 1:
        score += 4
    else:
        improvements.append("Add at least one experience entry with measurable bullet points.")

    total_bullets = sum(len(e.get("bullets") or []) for e in exp)
    if total_bullets >= 5:
        score += 8
        strengths.append("Bullet points present across experience.")
    else:
        improvements.append("Use 3–5 quantified bullet points per role (numbers, %, $).")

    numeric_bullets = [
        b for e in exp for b in (e.get("bullets") or []) if re.search(r"\d", b)
    ]
    if len(numeric_bullets) >= 3:
        score += 6
        strengths.append("Bullets include quantified impact (numbers/percentages).")
    else:
        improvements.append("Quantify more achievements with concrete metrics.")

    skills_count = sum(len(g.get("items") or []) for g in (r.get("skills") or []))
    if skills_count >= 8:
        score += 6
        strengths.append(f"Strong skills section with {skills_count} items.")
    else:
        improvements.append("List at least 8 ATS-friendly hard skills.")

    if r.get("education"):
        score += 4
    else:
        improvements.append("Include education or relevant credentials.")

    if r.get("projects"):
        score += 3
    if r.get("achievements"):
        score += 2
    if r.get("certifications"):
        score += 2

    if jd and len(jd.strip()) > 30:
        jd_words = {
            w for w in re.findall(r"[a-z][a-z0-9+.#\-]{2,}", jd.lower())
            if w not in _STOPWORDS
        }
        resume_text = json.dumps(r).lower()
        matched = [w for w in jd_words if w in resume_text]
        ratio = len(matched) / max(len(jd_words), 1)
        score += round(ratio * 12)
        pct = round(ratio * 100)
        if ratio >= 0.5:
            strengths.append(f"Strong keyword overlap with the job description ({pct}%).")
        else:
            improvements.append(
                f"Only {pct}% of job description keywords appear — mirror more terms."
            )

    score = max(0, min(100, score))
    if not strengths:
        strengths.append("Basic structure detected.")
    if not improvements:
        improvements.append("Tighten language and quantify outcomes further.")

    return {"score": score, "strengths": strengths, "improvements": improvements}
