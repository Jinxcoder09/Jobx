"""
jobX — FastAPI backend entry point

Replaces the original TypeScript/Express api-server.
Same routes, same request/response shapes, same MongoDB Atlas + Groq behaviour.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import connect_db, close_db
from app.routes import (
    health_router,
    templates_router,
    resumes_router,
    ai_router,
    documents_router,
)

# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("jobx")


# ─── Keep-alive (prevent Render from spinning down) ──────────────────────────

async def keep_alive():
    url = settings.RENDER_EXTERNAL_URL
    if not url:
        logger.info("RENDER_EXTERNAL_URL not set — keep-alive disabled")
        return
    health_url = f"{url.rstrip('/')}/api/healthz"
    logger.info("Keep-alive started — pinging %s every 14 min", health_url)
    async with httpx.AsyncClient() as client:
        while True:
            await asyncio.sleep(14 * 60)
            try:
                r = await client.get(health_url, timeout=10)
                logger.info("Keep-alive ping → %s", r.status_code)
            except Exception as exc:
                logger.warning("Keep-alive ping failed: %s", exc)


# ─── Lifespan (startup / shutdown) ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to MongoDB Atlas…")
    await connect_db()
    
    # Verify Playwright Chromium installation and install if missing
    import subprocess
    import sys
    try:
        logger.info("Verifying Playwright Chromium browser binaries...")
        from playwright.async_api import async_playwright
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                await browser.close()
            logger.info("Playwright Chromium is already installed.")
        except Exception as launch_err:
            logger.warning(f"Playwright Chromium launch failed, attempting to install: {launch_err}")
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
            logger.info("Playwright Chromium browser check/installation complete.")
    except Exception as e:
        logger.warning(f"Could not verify/install Playwright Chromium at startup: {e}")
        
    task = asyncio.create_task(keep_alive())
    yield
    logger.info("Shutting down — closing MongoDB connection…")
    task.cancel()
    await close_db()


# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="jobX API",
    version="1.0.0",
    description="AI Resume Builder API — Python/FastAPI edition",
    lifespan=lifespan,
)

# CORS — mirrors the original Express cors() behaviour
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global error handler ────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc) or "Internal Server Error"},
    )


# ─── Routers (all mounted under /api, matching the original /api prefix) ─────

API_PREFIX = "/api"

app.include_router(health_router,    prefix=API_PREFIX)
app.include_router(templates_router, prefix=API_PREFIX)
app.include_router(resumes_router,   prefix=API_PREFIX)
app.include_router(ai_router,        prefix=API_PREFIX)
app.include_router(documents_router, prefix=API_PREFIX)


# ─── Dev entrypoint ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        log_level="info",
    )
