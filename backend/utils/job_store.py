"""
RubricJudge — TTL-based eviction-safe in-memory Job Store.

Each job gets an asyncio.Queue for SSE events and a slot for the final result.
A background cleanup pass removes jobs older than `ttl_seconds` to prevent
memory leaks when browser tabs close mid-evaluation.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Dict, Optional


class JobStore:
    """Thread-safe (within the same event loop) in-memory job registry."""

    def __init__(self, ttl_seconds: int = 1800) -> None:
        self._queues: Dict[str, asyncio.Queue] = {}
        self._results: Dict[str, Any] = {}
        self._statuses: Dict[str, str] = {}         # "pending" | "running" | "completed" | "failed"
        self._created_at: Dict[str, float] = {}
        self._updated_at: Dict[str, float] = {}
        self._tasks: Dict[str, asyncio.Task] = {}   # background evaluation tasks
        self._ttl = ttl_seconds

    # ------------------------------------------------------------------
    # Job lifecycle
    # ------------------------------------------------------------------

    def create_job(self) -> str:
        """Create a new job, returning its unique ID."""
        self._cleanup_expired()
        job_id = str(uuid.uuid4())
        self._queues[job_id] = asyncio.Queue()
        self._statuses[job_id] = "pending"
        now = time.time()
        self._created_at[job_id] = now
        self._updated_at[job_id] = now
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
    # Queue / event helpers
    # ------------------------------------------------------------------

    def get_queue(self, job_id: str) -> Optional[asyncio.Queue]:
        return self._queues.get(job_id)

    async def push_event(self, job_id: str, event_data: dict) -> None:
        """Push a progress event onto the job's SSE queue."""
        queue = self._queues.get(job_id)
        if queue:
            self._updated_at[job_id] = time.time()
            await queue.put(event_data)

    # ------------------------------------------------------------------
    # Result helpers
    # ------------------------------------------------------------------

    def set_result(self, job_id: str, result: Any) -> None:
        self._results[job_id] = result
        self._statuses[job_id] = "completed"
        self._updated_at[job_id] = time.time()

    def get_result(self, job_id: str) -> Optional[Any]:
        return self._results.get(job_id)

    def set_status(self, job_id: str, status: str) -> None:
        self._statuses[job_id] = status
        self._updated_at[job_id] = time.time()

    def get_status(self, job_id: str) -> Optional[str]:
        return self._statuses.get(job_id)

    def get_created_at(self, job_id: str) -> float:
        return self._created_at.get(job_id, 0.0)

    def get_updated_at(self, job_id: str) -> float:
        return self._updated_at.get(job_id, 0.0)

    def job_exists(self, job_id: str) -> bool:
        return job_id in self._queues

    # ------------------------------------------------------------------
    # TTL cleanup
    # ------------------------------------------------------------------

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired = [
            jid for jid, t in self._created_at.items()
            if now - t > self._ttl
        ]
        for jid in expired:
            self.cancel_job(jid)
            self._queues.pop(jid, None)
            self._results.pop(jid, None)
            self._statuses.pop(jid, None)
            self._created_at.pop(jid, None)
            self._updated_at.pop(jid, None)
            self._tasks.pop(jid, None)

    async def run_cleanup_loop(self, interval_seconds: int = 300) -> None:
        """Long-running background coroutine; start as an asyncio task on app startup."""
        while True:
            await asyncio.sleep(interval_seconds)
            self._cleanup_expired()


# Module-level singleton used across the app
job_store = JobStore(ttl_seconds=1800)
