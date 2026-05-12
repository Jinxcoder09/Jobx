from fastapi import APIRouter
from ..models import Template
from ..templates import TEMPLATES

router = APIRouter()


@router.get("/templates", response_model=list[Template])
async def list_templates() -> list[Template]:
    return TEMPLATES
