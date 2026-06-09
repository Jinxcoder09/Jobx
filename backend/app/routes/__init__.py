from .health import router as health_router
from .templates import router as templates_router
from .resumes import router as resumes_router
from .ai import router as ai_router
from .documents import router as documents_router

__all__ = [
    "health_router",
    "templates_router",
    "resumes_router",
    "ai_router",
    "documents_router",
]

