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
    AiOptimizeRequest,
    AiOptimizeResponse,
    ResumeData,
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
    context_lower = (body.context or "").lower()
    
    if "education" in context_lower:
        if not body.text.strip():
            system_content = (
                "You are a resume writer. Write a concise, professional description or notes for an education entry "
                "based on the context provided (e.g. school, degree, field). Focus on coursework, honors, or academic activities. "
                "Keep it under 2 sentences. Return only the description, no preface."
            )
        else:
            system_content = (
                "You are a resume writer. Refine and polish the given education notes/description. "
                "Make it sound professional, focusing on academic achievement, coursework, honors, or activities. "
                "Keep it concise (1-2 sentences). Return only the polished description, no preface."
            )
    elif "project" in context_lower:
        if not body.text.strip():
            system_content = (
                "You are a resume writer. Write a concise, professional description for a project entry "
                "based on the context provided (e.g. project name, technologies). Highlight technical challenges, solutions, or purpose. "
                "Keep it under 2 sentences. Return only the description, no preface."
            )
        else:
            system_content = (
                "You are a resume writer. Refine and polish the given project description. "
                "Ensure it highlights technical challenges, solutions, and impact. Use professional, active language. "
                "Keep it concise (1-2 sentences). Return only the polished description, no preface."
            )
    elif any(x in context_lower for x in ["certification", "achievement", "custom"]):
        if not body.text.strip():
            system_content = (
                "You are a resume writer. Write a concise, professional description for a resume entry "
                "based on the context provided (e.g. title, subtitle). Focus on scope or impact. "
                "Keep it under 2 sentences. Return only the description, no preface."
            )
        else:
            system_content = (
                "You are a resume writer. Refine and polish the given description for a certification, "
                "achievement, or custom section item. Make it professional and concise. "
                "Keep it to 1-2 sentences. Return only the polished description, no preface."
            )
    else:
        system_content = (
            "You are a resume bullet point generator. Given a rough description "
            "or query, generate a polished resume bullet point. Lead with a strong "
            "action verb, quantify impact when reasonable, keep under 22 words, "
            "no first person, no buzzwords. Return only the bullet point, no preface."
        )

    text = await groq_chat(
        [
            {
                "role": "system",
                "content": system_content,
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


@router.post("/ai/optimize-resume", response_model=AiOptimizeResponse)
async def ai_optimize_resume(body: AiOptimizeRequest) -> dict:
    import json

    resume_dict = body.resume.model_dump()
    resume_json = json.dumps(resume_dict)

    system_prompt = (
        "You are an expert resume writer and ATS optimization engine. Your goal is to maximize the ATS score of the resume. "
        "You must return a STRICT JSON object representing the optimized resume data. "
        "The returned JSON must have the EXACT same structure and keys as the input JSON, preserving all IDs (e.g. 'id') and personal details. "
        "\n"
        "Apply these specific optimizations to the content:\n"
        "1. Remove repeating overused verbs (like 'led', 'managed', 'worked', 'assisted', 'responsible for') by replacing them with diverse, strong, active industry verbs (e.g. 'spearheaded', 'orchestrated', 'engineered', 'championed', 'designed', 'optimized', 'cultivated').\n"
        "2. Quantify achievements: Review every bullet point, project description, and achievement. If a bullet or description lacks numbers or metrics, inject realistic, professional metrics (e.g., percentages, dollar amounts, time saved, team sizes, scale numbers like 'boosted performance by 24%', 'saved $12k annually', 'collaborated with a 6-person team'). Make them sound natural and contextually appropriate.\n"
        "3. Standardize dates: Convert all dates (e.g. in experience, education, certifications, achievements, custom sections) to a clean 'Month Year' format (e.g., 'Jun 2023', 'Dec 2021', 'Present'). If a date is empty or says 'Present' / 'Current', leave it as is.\n"
        "4. Keep personal info (fullName, email, phone, location, website, linkedin, github, photoUrl), template preferences, and layout structure completely unchanged.\n"
        "5. Preserve the exact value of all 'id' fields so React rendering keys and order are maintained.\n"
        "\n"
        "Return ONLY the raw JSON object matching the input structure, with no markdown formatting, no code block backticks, and no conversational text."
    )

    try:
        raw = await groq_chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Input Resume JSON:\n{resume_json}"},
            ],
            temperature=0.3,
            json_mode=True,
            max_tokens=4000,
        )
        parsed = extract_json(raw)
        if not parsed or not isinstance(parsed, dict):
            raise ValueError("Groq returned invalid or empty JSON")

        optimized_data = _merge_optimized_data(resume_dict, parsed)
        return {"data": ResumeData(**optimized_data)}
    except Exception as e:
        logger.warning("Resume optimization failed, falling back to original: %s", e)
        return {"data": body.resume}


def _merge_optimized_data(original: dict, optimized: dict) -> dict:
    result = original.copy()

    # Update summary
    if "summary" in optimized and isinstance(optimized["summary"], str):
        result["summary"] = optimized["summary"]

    # Helper to merge items in lists by ID
    def merge_list_by_id(orig_list: list, opt_list: list, fields_to_copy: list[str], list_fields: dict[str, list] = None) -> list:
        if not isinstance(orig_list, list) or not isinstance(opt_list, list):
            return orig_list
        opt_map = {item.get("id"): item for item in opt_list if isinstance(item, dict) and item.get("id")}
        new_list = []
        for orig_item in orig_list:
            if not isinstance(orig_item, dict):
                new_list.append(orig_item)
                continue
            item_id = orig_item.get("id")
            opt_item = opt_map.get(item_id)
            if opt_item:
                merged_item = orig_item.copy()
                for field in fields_to_copy:
                    if field in opt_item:
                        merged_item[field] = opt_item[field]
                if list_fields:
                    for field in list_fields.keys():
                        if field in opt_item and isinstance(opt_item[field], list):
                            merged_item[field] = opt_item[field]
                new_list.append(merged_item)
            else:
                new_list.append(orig_item)
        return new_list

    # Experience
    result["experience"] = merge_list_by_id(
        original.get("experience"),
        optimized.get("experience"),
        ["role", "company", "location", "startDate", "endDate"],
        {"bullets": []}
    )

    # Education
    result["education"] = merge_list_by_id(
        original.get("education"),
        optimized.get("education"),
        ["school", "degree", "field", "location", "startDate", "endDate", "gpa", "description"]
    )

    # Projects
    result["projects"] = merge_list_by_id(
        original.get("projects"),
        optimized.get("projects"),
        ["name", "link", "description"],
        {"bullets": [], "technologies": []}
    )

    # Skills
    result["skills"] = merge_list_by_id(
        original.get("skills"),
        optimized.get("skills"),
        ["category"],
        {"items": []}
    )

    # Certifications
    result["certifications"] = merge_list_by_id(
        original.get("certifications"),
        optimized.get("certifications"),
        ["title", "subtitle", "date", "description"]
    )

    # Achievements
    result["achievements"] = merge_list_by_id(
        original.get("achievements"),
        optimized.get("achievements"),
        ["title", "subtitle", "date", "description"]
    )

    # Languages
    result["languages"] = merge_list_by_id(
        original.get("languages"),
        optimized.get("languages"),
        ["name", "level"]
    )

    # Custom sections
    orig_custom = original.get("custom")
    opt_custom = optimized.get("custom")
    if isinstance(orig_custom, list) and isinstance(opt_custom, list):
        opt_custom_map = {c.get("id"): c for c in opt_custom if isinstance(c, dict) and c.get("id")}
        new_custom = []
        for orig_c in orig_custom:
            if not isinstance(orig_c, dict):
                new_custom.append(orig_c)
                continue
            cid = orig_c.get("id")
            opt_c = opt_custom_map.get(cid)
            if opt_c:
                merged_c = orig_c.copy()
                if "title" in opt_c:
                    merged_c["title"] = opt_c["title"]

                orig_items = orig_c.get("items")
                opt_items = opt_c.get("items")
                merged_c["items"] = merge_list_by_id(
                    orig_items,
                    opt_items,
                    ["title", "subtitle", "date", "description"]
                )
                new_custom.append(merged_c)
            else:
                new_custom.append(orig_c)
        result["custom"] = new_custom

    return result


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
