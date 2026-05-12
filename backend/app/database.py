import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from .config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        serverSelectionTimeoutMS=8000,
    )
    # Verify connection
    await _client.admin.command("ping")
    logger.info("MongoDB Atlas connected (db=%s)", settings.MONGODB_DB)


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed")


def get_resumes_collection() -> AsyncIOMotorCollection:
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    db = _client[settings.MONGODB_DB]
    return db[settings.MONGODB_COLLECTION]
