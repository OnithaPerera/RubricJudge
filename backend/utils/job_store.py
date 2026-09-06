"""
RubricJudge -- Persistent Job Store (aiosqlite + in-memory SSE queues)

Storage strategy:
  - SQLite (via aiosqlite) persists job metadata and completed results so
    they survive server restarts.
  - asyncio.Queue instances remain in-memory per active job for real-time
    SSE event delivery. Queues are inherently ephemeral and are not persisted.
  - A background cleanup loop evicts rows and queues older than ttl_seconds.

The module exposes a singleton `job_store` instance. Call `await job_store.init_db()`
once during the FastAPI lifespan startup before any other operations.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

import aiosqlite

logger = logging.getLogger(__name__)

# Default database file location (next to the backend source files).
_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "rubricjudge.db"


class JobStore:
    """Async-safe job registry backed by SQLite with in-memory SSE queues."""

    def __init__(
        self,
        db_path: str | Path = _DEFAULT_DB_PATH,
        ttl_seconds: int = 1800,
    ) -> None:
        self._db_path = str(db_path)
        self._ttl = ttl_seconds

        # In-memory structures (not persisted).
        self._queues: Dict[str, asyncio.Queue] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

        # Set after init_db() is awaited.
        self._db: Optional[aiosqlite.Connection] = None

    # ------------------------------------------------------------------
    # Database initialisation
    # ------------------------------------------------------------------

    async def init_db(self) -> None:
        """
        Open the SQLite connection and create the jobs table if it does not
        already exist. Must be awaited once during application startup.
        """
        self._db = await aiosqlite.connect(self._db_path)
        # Enable WAL mode for better concurrent read performance.
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id          TEXT PRIMARY KEY,
                status      TEXT NOT NULL DEFAULT 'pending',
                result_json TEXT,
                created_at  REAL NOT NULL,
                updated_at  REAL NOT NULL
            )
        """)
        await self._db.commit()
        logger.info("Job store initialised (db=%s).", self._db_path)

    async def close(self) -> None:
        """Close the database connection gracefully."""
        if self._db:
            await self._db.close()
            self._db = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_db(self) -> aiosqlite.Connection:
        """Raise if init_db() has not been called yet."""
        if self._db is None:
            raise RuntimeError(
                "JobStore.init_db() must be awaited before using the store."
            )
        return self._db

    # ------------------------------------------------------------------
    # Job lifecycle
    # ------------------------------------------------------------------

    async def create_job(self) -> str:
        """Create a new job row in SQLite and return its unique ID."""
        db = self._ensure_db()
        job_id = str(uuid.uuid4())
        now = time.time()
        await db.execute(
            "INSERT INTO jobs (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (job_id, "pending", now, now),
        )
        await db.commit()
        self._queues[job_id] = asyncio.Queue()
        return job_id

    def register_task(self, job_id: str, task: asyncio.Task) -> None:
        """Associate an asyncio background task with a job for cancellation."""
        self._tasks[job_id] = task

    def cancel_job(self, job_id: str) -> bool:
        """Cancel the background evaluation task (e.g. when SSE client disconnects)."""
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    # ------------------------------------------------------------------
    # Queue / SSE event helpers
    # ------------------------------------------------------------------

    def get_queue(self, job_id: str) -> Optional[asyncio.Queue]:
        return self._queues.get(job_id)

    async def push_event(self, job_id: str, event_data: dict) -> None:
        """Push a progress event onto the job's in-memory SSE queue."""
        queue = self._queues.get(job_id)
        if queue:
            await queue.put(event_data)

    # ------------------------------------------------------------------
    # Result persistence
    # ------------------------------------------------------------------

    async def set_result(self, job_id: str, result: Any) -> None:
        """
        Persist the final result JSON to SQLite and mark the job as completed.
        Accepts either a Pydantic model (with .model_dump()) or a plain dict.
        """
        db = self._ensure_db()
        if hasattr(result, "model_dump"):
            result_json = json.dumps(result.model_dump(mode="json"), default=str)
        elif isinstance(result, dict):
            result_json = json.dumps(result, default=str)
        else:
            result_json = json.dumps(result, default=str)
        now = time.time()
        await db.execute(
            "UPDATE jobs SET status = ?, result_json = ?, updated_at = ? WHERE id = ?",
            ("completed", result_json, now, job_id),
        )
        await db.commit()

    async def get_result(self, job_id: str) -> Optional[dict]:
        """
        Retrieve the completed result for a job from SQLite.
        Returns None if the job does not exist or has no result yet.
        """
        db = self._ensure_db()
        async with db.execute(
            "SELECT result_json FROM jobs WHERE id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
        if row and row[0]:
            return json.loads(row[0])
        return None

    async def set_status(self, job_id: str, status: str) -> None:
        """Update the job status in SQLite."""
        db = self._ensure_db()
        now = time.time()
        await db.execute(
            "UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, job_id),
        )
        await db.commit()

    async def get_status(self, job_id: str) -> Optional[str]:
        """Read the current status from SQLite."""
        db = self._ensure_db()
        async with db.execute(
            "SELECT status FROM jobs WHERE id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
        return row[0] if row else None

    async def get_created_at(self, job_id: str) -> float:
        db = self._ensure_db()
        async with db.execute(
            "SELECT created_at FROM jobs WHERE id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
        return row[0] if row else 0.0

    async def get_updated_at(self, job_id: str) -> float:
        db = self._ensure_db()
        async with db.execute(
            "SELECT updated_at FROM jobs WHERE id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
        return row[0] if row else 0.0

    async def job_exists(self, job_id: str) -> bool:
        """Check if a job ID exists in SQLite."""
        db = self._ensure_db()
        async with db.execute(
            "SELECT 1 FROM jobs WHERE id = ?", (job_id,)
        ) as cursor:
            row = await cursor.fetchone()
        return row is not None

    # ------------------------------------------------------------------
    # TTL cleanup
    # ------------------------------------------------------------------

    async def _cleanup_expired(self) -> None:
        """Delete expired jobs from SQLite and evict stale in-memory queues."""
        db = self._ensure_db()
        cutoff = time.time() - self._ttl

        # Find expired job IDs before deleting so we can clean up in-memory state.
        expired_ids: list[str] = []
        async with db.execute(
            "SELECT id FROM jobs WHERE created_at < ?", (cutoff,)
        ) as cursor:
            async for row in cursor:
                expired_ids.append(row[0])

        if expired_ids:
            # Delete from SQLite.
            placeholders = ",".join("?" for _ in expired_ids)
            await db.execute(
                f"DELETE FROM jobs WHERE id IN ({placeholders})", expired_ids
            )
            await db.commit()

            # Clean up in-memory structures.
            for jid in expired_ids:
                self.cancel_job(jid)
                self._queues.pop(jid, None)
                self._tasks.pop(jid, None)

            logger.info("Cleaned up %d expired job(s).", len(expired_ids))

    async def run_cleanup_loop(self, interval_seconds: int = 300) -> None:
        """
        Long-running background coroutine that periodically evicts expired jobs.
        Start as an asyncio task on app startup.
        """
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                await self._cleanup_expired()
            except Exception as exc:
                logger.error("Cleanup loop error: %s", exc)


# Module-level singleton used across the app.
job_store = JobStore()
