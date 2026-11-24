import os
import json
from datetime import datetime, timezone
from typing import List, Optional, Tuple
import aiosqlite
from app.config import settings


def get_db_path() -> str:
    path = settings.sqlite_db_path
    parent_dir = os.path.dirname(path)
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)
    return path


async def init_db() -> None:
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL
            );
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages (session_id);
        """)
        await db.commit()


async def check_db_health() -> bool:
    try:
        db_path = get_db_path()
        async with aiosqlite.connect(db_path) as db:
            cursor = await db.execute("SELECT 1;")
            await cursor.fetchone()
            return True
    except Exception:
        return False


async def save_message(
    session_id: str,
    role: str,
    content: str,
    metadata: Optional[dict] = None
) -> None:
    db_path = get_db_path()
    created_at = datetime.now(timezone.utc).isoformat()
    meta_json = json.dumps(metadata) if metadata is not None else None
    
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            """
            INSERT INTO messages (session_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (session_id, role, content, meta_json, created_at)
        )
        await db.commit()


async def get_session_history_for_llm(session_id: str) -> List[dict]:
    """Returns list of {'role': role, 'content': content} ordered oldest first."""
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT role, content
            FROM messages
            WHERE session_id = ?
            ORDER BY id ASC
            """,
            (session_id,)
        )
        rows = await cursor.fetchall()
        return [{"role": row["role"], "content": row["content"]} for row in rows]


async def get_session_messages(session_id: str) -> Optional[List[dict]]:
    """Returns stored history for GET /sessions/{session_id}/messages or None if session not found."""
    db_path = get_db_path()
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT role, content, metadata
            FROM messages
            WHERE session_id = ?
            ORDER BY id ASC
            """,
            (session_id,)
        )
        rows = await cursor.fetchall()
        if not rows:
            return None
        
        result = []
        for row in rows:
            msg = {
                "role": row["role"],
                "content": row["content"]
            }
            if row["metadata"]:
                try:
                    msg["metadata"] = json.loads(row["metadata"])
                except Exception:
                    msg["metadata"] = None
            result.append(msg)
        return result
