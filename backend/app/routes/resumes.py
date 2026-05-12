import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pymongo import ReturnDocument

from ..database import get_resumes_collection
from ..models import (
    CreateResumeInput,
    DeleteResult,
    PersonalInfo,
    Resume,
    ResumeData,
    ResumeSummary,
    Theme,
    UpdateResumeInput,
)

router = APIRouter()

# ─── Defaults ────────────────────────────────────────────────────────────────

def _default_theme() -> Theme:
    return Theme(
        fontFamily="Inter",
        fontSize=11,
        lineSpacing=1.4,
        sectionSpacing=16,
        primaryColor="#0f172a",
        secondaryColor="#475569",
        accentColor="#2563eb",
        layout="single",
    )


def _empty_data() -> ResumeData:
    return ResumeData(
        personal=PersonalInfo(),
        summary="",
        experience=[],
        education=[],
        projects=[],
        skills=[],
        certifications=[],
        achievements=[],
        languages=[],
        custom=[],
        sectionOrder=[
            "summary", "experience", "education", "projects",
            "skills", "certifications", "achievements", "languages",
        ],
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_to_resume(doc: dict) -> dict:
    """Strip Mongo _id before returning to client."""
    doc.pop("_id", None)
    return doc


# ─── List ─────────────────────────────────────────────────────────────────────

@router.get("/resumes", response_model=list[ResumeSummary])
async def list_resumes() -> list[dict]:
    col = get_resumes_collection()
    cursor = col.find(
        {},
        projection={"_id": 0, "id": 1, "title": 1, "templateId": 1, "updatedAt": 1},
    ).sort("updatedAt", -1)
    return await cursor.to_list(length=1000)


# ─── Create ───────────────────────────────────────────────────────────────────

@router.post("/resumes", response_model=Resume)
async def create_resume(body: CreateResumeInput) -> dict:
    col = get_resumes_collection()
    now = _now()
    doc = {
        "id": str(uuid.uuid4()),
        "title": body.title,
        "templateId": body.templateId,
        "theme": _default_theme().model_dump(),
        "data": _empty_data().model_dump(),
        "createdAt": now,
        "updatedAt": now,
    }
    await col.insert_one(doc)
    return _doc_to_resume(doc)


# ─── Get ──────────────────────────────────────────────────────────────────────

@router.get("/resumes/{resume_id}", response_model=Resume)
async def get_resume(resume_id: str) -> dict:
    col = get_resumes_collection()
    doc = await col.find_one({"id": resume_id}, projection={"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
    return doc


# ─── Update ───────────────────────────────────────────────────────────────────

@router.put("/resumes/{resume_id}", response_model=Resume)
async def update_resume(resume_id: str, body: UpdateResumeInput) -> dict:
    col = get_resumes_collection()
    update_fields: dict = {"updatedAt": _now()}

    if body.title is not None:
        update_fields["title"] = body.title
    if body.templateId is not None:
        update_fields["templateId"] = body.templateId
    if body.theme is not None:
        update_fields["theme"] = body.theme.model_dump()
    if body.data is not None:
        update_fields["data"] = body.data.model_dump()

    result = await col.find_one_and_update(
        {"id": resume_id},
        {"$set": update_fields},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Resume not found")
    return dict(result)


# ─── Delete ───────────────────────────────────────────────────────────────────

@router.delete("/resumes/{resume_id}", response_model=DeleteResult)
async def delete_resume(resume_id: str) -> dict:
    col = get_resumes_collection()
    result = await col.delete_one({"id": resume_id})
    return {"success": result.deleted_count == 1}
