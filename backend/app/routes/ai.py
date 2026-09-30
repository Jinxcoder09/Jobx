"""AI writing, parsing, ATS scoring, and safe resume-optimization endpoints."""
from __future__ import annotations
import json
import logging
import random
import re
import string
from collections import Counter
from typing import Any

from fastapi import APIRouter, HTTPException

from ..groq_client import groq_chat, extract_json
from ..models import (
    AiGrammarRequest,
    AiImproveRequest,
    AiOptimizeRequest,
    AiOptimizeResponse,
    AiParseRequest,
    AiParseResponse,
    AiScoreRequest,
    AiScoreResponse,
    ResumeData,
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
                    "Rewrite resume bullet points: lead with a strong action verb, "
                    "quantify impact when reasonable, keep under 22 words, no first "
                    "person, no buzzwords. Return only the rewritten bullet, no preface."
                ),
            },
            {
                "role": "user",
                "content": f"Context: {body.context or 'general'}\nOriginal: {body.text}",
            },
        ],
        temperature=0.5,
        max_tokens=120,
    )
    return {"text": text}


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

async def _analyze_ats_score(resume: dict | None, job_description: str | None = None) -> dict:
    """Run the AI ATS review, with the existing deterministic fallback."""
    resume_json = json.dumps(resume or {}, ensure_ascii=False)[:12000]
    parsed: dict | None = None

    try:
        raw = await groq_chat(
            [
                {
                    "role": "system",
                    "content": (
                        'You are an ATS reviewer. Reply with one JSON object only, no markdown: '
                        '{"score": <0-100 integer>, "strengths": ["..."], "improvements": ["..."]}. '
                        "3-6 items per array. Be specific and actionable. Apply a consistent rubric "
                        "covering completeness, measurable impact, clarity, formatting, and job-keyword alignment."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Resume JSON:\n{resume_json}\n\n"
                        f"Job description (optional):\n{job_description or ''}"
                    ),
                },
            ],
            temperature=0.2,
            json_mode=True,
            max_tokens=800,
        )
        parsed = extract_json(raw)
    except Exception as e:
        logger.warning("ATS Groq call failed, using heuristic: %s", e)

    if not parsed or not isinstance(parsed, dict):
        return _heuristic_score(resume, job_description)

    score = parsed.get("score")
    score = (
        max(0, min(100, int(score)))
        if isinstance(score, (int, float))
        else _heuristic_score(resume, job_description).get("score", 50)
    )
    strengths = [s.strip() for s in _arr(parsed.get("strengths")) if isinstance(s, str) and s.strip()]
    improvements = [s.strip() for s in _arr(parsed.get("improvements")) if isinstance(s, str) and s.strip()]

    # A malformed-but-parseable model response should still give useful feedback.
    fallback = _heuristic_score(resume, job_description)
    return {
        "score": score,
        "strengths": strengths or fallback["strengths"],
        "improvements": improvements or fallback["improvements"],
    }


@router.post("/ai/score", response_model=AiScoreResponse)
async def ai_ats_score(body: AiScoreRequest) -> dict:
    return await _analyze_ats_score(body.resume, body.jobDescription)


# ─── /ai/optimize ────────────────────────────────────────────────────────────

@router.post("/ai/optimize", response_model=AiOptimizeResponse)
async def ai_optimize_resume(body: AiOptimizeRequest) -> dict:
    """
    Improve ATS-facing copy, merge only safe fields into the original resume,
    and then run a fresh ATS review of the updated result.

    The AI returns a small patch rather than a full resume. Factual identity,
    employers, dates, credentials, links, and contact data are therefore never
    accepted from the model. Numeric claims and unsupported skill additions are
    also rejected by the merge layer.
    """
    original = body.resume.model_dump()
    previous_score = body.currentScore
    if previous_score is None:
        previous_score = (await _analyze_ats_score(original, body.jobDescription))["score"]

    feedback = "\n".join(f"- {item.strip()[:500]}" for item in body.feedback if item.strip())
    resume_json = json.dumps(original, ensure_ascii=False)
    if len(resume_json) > 24000:
        raise HTTPException(
            status_code=413,
            detail="This resume is too large to enhance in one request. Shorten long sections and try again.",
        )

    patch_schema = (
        '{"optimized": {'
        '"summary": "", '
        '"experience": [{"index": 0, "id": "", "bullets": [""]}], '
        '"education": [{"index": 0, "id": "", "description": ""}], '
        '"projects": [{"index": 0, "id": "", "description": "", "bullets": [""]}], '
        '"skills": [{"index": 0, "id": "", "items": [""]}], '
        '"certifications": [{"index": 0, "id": "", "description": ""}], '
        '"achievements": [{"index": 0, "id": "", "description": ""}], '
        '"custom": [{"sectionIndex": 0, "itemIndex": 0, "description": ""}]'
        '}, "changes": ["..."]}'
    )

    try:
        raw = await groq_chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are a senior resume editor optimizing content for applicant tracking systems. "
                        "Return one strict JSON object only. Rewrite copy to be concise, specific, action-led, "
                        "and naturally keyword-aligned with the supplied job description. Fix grammar and remove "
                        "filler. Keep each experience/project bullet concise.\n\n"
                        "TRUTHFULNESS RULES (mandatory):\n"
                        "- Never invent or guess achievements, responsibilities, tools, skills, employers, titles, "
                        "education, credentials, dates, or metrics.\n"
                        "- Preserve every number exactly. If the source has no metric, do not add one.\n"
                        "- Add a job-description keyword only when the original resume clearly proves it.\n"
                        "- Keep list entries in the same order and keep the same number of bullets.\n"
                        "- Return only the editable fields in the provided patch schema; do not return personal "
                        "details or other factual fields.\n\n"
                        f"Required JSON shape: {patch_schema}"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Current ATS score: {previous_score}/100\n"
                        f"Current ATS feedback:\n{feedback or '- Improve ATS clarity and relevance.'}\n\n"
                        f"Job description (optional):\n{body.jobDescription or ''}\n\n"
                        f"Original resume JSON:\n{resume_json}"
                    ),
                },
            ],
            temperature=0.25,
            json_mode=True,
            max_tokens=5000,
        )
        parsed = extract_json(raw)
    except Exception as exc:
        logger.exception("ATS optimization call failed")
        raise HTTPException(
            status_code=502,
            detail="The AI could not enhance the resume right now. Please try again.",
        ) from exc

    if not parsed or not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="The AI returned an invalid resume enhancement. Please try again.")

    patch = parsed.get("optimized", parsed)
    if not isinstance(patch, dict):
        raise HTTPException(status_code=502, detail="The AI returned an invalid resume enhancement. Please try again.")

    optimized, changes = _merge_optimization_patch(original, patch)
    if not changes:
        raise HTTPException(
            status_code=422,
            detail="No safe ATS improvements were found. Add more detail or a job description and try again.",
        )

    rescored = await _analyze_ats_score(optimized, body.jobDescription)
    return {
        "data": optimized,
        "previousScore": previous_score,
        "score": rescored["score"],
        "strengths": rescored["strengths"],
        "improvements": rescored["improvements"],
        "changes": changes,
    }


# ─── Optimization safety / merge helpers ─────────────────────────────────────

_NUMBER_RE = re.compile(r"(?<![A-Za-z])(?:[$€£]?\d[\d,.]*(?:%|x|\+)?)(?![A-Za-z])", re.IGNORECASE)


def _numbers(value: str) -> Counter[str]:
    return Counter(match.group(0).lower() for match in _NUMBER_RE.finditer(value or ""))


def _safe_rewrite(original: Any, candidate: Any) -> str:
    """Accept non-empty copy only when it does not alter numeric claims."""
    source = _str(original).strip()
    edited = _str(candidate).strip()
    if not edited or edited == source:
        return source
    if _numbers(source) != _numbers(edited):
        return source
    return edited


def _patch_for(entries: Any, index: int, item_id: str = "") -> dict:
    patches = [_obj(entry) for entry in _arr(entries)]
    if item_id:
        by_id = next((entry for entry in patches if _str(entry.get("id")) == item_id), None)
        if by_id is not None:
            return by_id
    return next(
        (
            entry
            for entry in patches
            if isinstance(entry.get("index"), int) and entry.get("index") == index
        ),
        {},
    )


def _safe_bullets(original: Any, candidate: Any) -> list[str]:
    source = [_str(value) for value in _arr(original)]
    proposed = _arr(candidate)
    # Refuse output that drops/adds bullets; those changes are more likely to
    # lose facts or introduce unsupported claims than a one-for-one rewrite.
    if len(proposed) != len(source):
        return source
    return [_safe_rewrite(value, proposed[index]) for index, value in enumerate(source)]


def _skill_key(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]", "", value.casefold())


def _searchable_text(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.]+", " ", value.casefold()).strip()


def _supported_skill(skill: str, evidence: str) -> bool:
    normalized = _searchable_text(skill)
    if len(_skill_key(normalized)) < 2:
        return False
    searchable_evidence = _searchable_text(evidence)
    return f" {normalized} " in f" {searchable_evidence} "


def _resume_skill_evidence(resume: dict) -> str:
    """Return source content that can substantiate a skill keyword."""
    parts: list[str] = [_str(resume.get("summary"))]
    for item in _arr(resume.get("experience")):
        entry = _obj(item)
        parts.extend([_str(entry.get("role")), *_str_arr(entry.get("bullets"))])
    for item in _arr(resume.get("education")):
        entry = _obj(item)
        parts.extend(
            [_str(entry.get("degree")), _str(entry.get("field")), _str(entry.get("description"))]
        )
    for item in _arr(resume.get("projects")):
        entry = _obj(item)
        parts.extend(
            [
                _str(entry.get("description")),
                *_str_arr(entry.get("bullets")),
                *_str_arr(entry.get("technologies")),
            ]
        )
    for section in ("certifications", "achievements"):
        for item in _arr(resume.get(section)):
            entry = _obj(item)
            parts.extend(
                [
                    _str(entry.get("title")),
                    _str(entry.get("subtitle")),
                    _str(entry.get("description")),
                ]
            )
    for section in _arr(resume.get("custom")):
        for item in _arr(_obj(section).get("items")):
            entry = _obj(item)
            parts.extend([_str(entry.get("title")), _str(entry.get("description"))])
    return "\n".join(part for part in parts if part)


def _merge_optimization_patch(original: dict, patch: dict) -> tuple[dict, list[str]]:
    """Merge AI-editable copy while retaining all factual source fields."""
    # ResumeData produces a known JSON-safe shape and strips unknown keys.
    result = ResumeData.model_validate(original).model_dump()
    changes: list[str] = []

    summary = _safe_rewrite(result.get("summary"), patch.get("summary"))
    if summary != result.get("summary", ""):
        result["summary"] = summary
        changes.append("Reworked the professional summary for ATS clarity and relevance.")

    rewritten_experience_bullets = 0
    for index, item in enumerate(result["experience"]):
        item_patch = _patch_for(patch.get("experience"), index, item.get("id", ""))
        bullets = _safe_bullets(item.get("bullets"), item_patch.get("bullets"))
        rewritten_experience_bullets += sum(
            before != after for before, after in zip(item.get("bullets", []), bullets)
        )
        item["bullets"] = bullets
    if rewritten_experience_bullets:
        changes.append(
            f"Strengthened {rewritten_experience_bullets} experience bullet"
            f"{'s' if rewritten_experience_bullets != 1 else ''} with action-focused language."
        )

    rewritten_education = 0
    for index, item in enumerate(result["education"]):
        item_patch = _patch_for(patch.get("education"), index, item.get("id", ""))
        description = _safe_rewrite(item.get("description"), item_patch.get("description"))
        if description != item.get("description", ""):
            item["description"] = description
            rewritten_education += 1
    if rewritten_education:
        changes.append(f"Polished {rewritten_education} education description{'s' if rewritten_education != 1 else ''}.")

    rewritten_project_bullets = 0
    rewritten_project_descriptions = 0
    for index, item in enumerate(result["projects"]):
        item_patch = _patch_for(patch.get("projects"), index, item.get("id", ""))
        description = _safe_rewrite(item.get("description"), item_patch.get("description"))
        if description != item.get("description", ""):
            item["description"] = description
            rewritten_project_descriptions += 1
        bullets = _safe_bullets(item.get("bullets"), item_patch.get("bullets"))
        rewritten_project_bullets += sum(
            before != after for before, after in zip(item.get("bullets", []), bullets)
        )
        item["bullets"] = bullets
    if rewritten_project_descriptions or rewritten_project_bullets:
        changes.append("Improved project descriptions and bullets for stronger keyword matching.")

    # Candidate skills are admitted only when the original resume independently
    # contains that term. Existing skills always remain untouched.
    evidence = _resume_skill_evidence(original)
    added_skills = 0
    skill_patches = _arr(patch.get("skills"))
    if not result["skills"] and skill_patches:
        first_patch = _obj(skill_patches[0])
        supported = [
            skill.strip()
            for skill in _str_arr(first_patch.get("items"))
            if _supported_skill(skill, evidence)
        ]
        if supported:
            result["skills"].append({"id": _uid("s"), "category": "Skills", "items": list(dict.fromkeys(supported))})
            added_skills += len(result["skills"][0]["items"])
    else:
        for index, item in enumerate(result["skills"]):
            item_patch = _patch_for(skill_patches, index, item.get("id", ""))
            existing = [_str(skill).strip() for skill in item.get("items", []) if _str(skill).strip()]
            known = {_skill_key(skill) for skill in existing}
            additions = []
            for skill in _str_arr(item_patch.get("items")):
                key = _skill_key(skill)
                if key not in known and _supported_skill(skill, evidence):
                    known.add(key)
                    additions.append(skill)
            item["items"] = [*existing, *additions]
            added_skills += len(additions)
    if added_skills:
        changes.append(
            f"Added {added_skills} skill keyword{'s' if added_skills != 1 else ''} already supported by the resume."
        )

    for section, label in (
        ("certifications", "certification"),
        ("achievements", "achievement"),
    ):
        rewritten = 0
        for index, item in enumerate(result[section]):
            item_patch = _patch_for(patch.get(section), index, item.get("id", ""))
            description = _safe_rewrite(item.get("description"), item_patch.get("description"))
            if description != item.get("description", ""):
                item["description"] = description
                rewritten += 1
        if rewritten:
            changes.append(f"Polished {rewritten} {label} description{'s' if rewritten != 1 else ''}.")

    rewritten_custom = 0
    for raw_patch in _arr(patch.get("custom")):
        item_patch = _obj(raw_patch)
        section_index = item_patch.get("sectionIndex")
        item_index = item_patch.get("itemIndex")
        if not isinstance(section_index, int) or not isinstance(item_index, int):
            continue
        if section_index < 0 or section_index >= len(result["custom"]):
            continue
        items = result["custom"][section_index].get("items", [])
        if item_index < 0 or item_index >= len(items):
            continue
        item = items[item_index]
        description = _safe_rewrite(item.get("description"), item_patch.get("description"))
        if description != item.get("description", ""):
            item["description"] = description
            rewritten_custom += 1
    if rewritten_custom:
        changes.append(f"Polished {rewritten_custom} custom-section description{'s' if rewritten_custom != 1 else ''}.")

    return result, changes


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
