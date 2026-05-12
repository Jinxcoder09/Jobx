from fastapi import APIRouter
from ..models import HealthStatus

router = APIRouter()


@router.get("/healthz", response_model=HealthStatus)
async def health_check() -> HealthStatus:
    return HealthStatus(status="ok")
