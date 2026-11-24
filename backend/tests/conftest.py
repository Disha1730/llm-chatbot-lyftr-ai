import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Configure test environment before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test_app.db"
os.environ["LLM_API_KEYS"] = "mock-key-1,mock-key-2"
os.environ["ENABLE_FAILURE_SIMULATION"] = "true"
os.environ["LLM_MODEL"] = "gemini/gemini-2.0-flash"

from app.config import settings
from app.database import init_db
from app.cache import response_cache
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    # Reset database and cache before each test
    db_path = settings.sqlite_db_path
    if os.path.exists(db_path):
        os.remove(db_path)
    response_cache.clear()

    await init_db()

    yield

    if os.path.exists(db_path):
        os.remove(db_path)
    response_cache.clear()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
