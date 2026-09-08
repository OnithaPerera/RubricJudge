"""
RubricJudge -- FastAPI Application (Phase 1 Refactor)

Endpoints:
  POST /api/evaluate                   Accept text or file upload, kick off background pipeline
  GET  /api/evaluate/stream/{job_id}   SSE stream of progress events
  GET  /api/jobs/{job_id}/status       Quick polling endpoint

SSE Protocol:
  Each event is a JSON object matching StreamProgressEvent.
  The "completed" event carries the full FinalConsensusReport in the `result` field.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Load .env file BEFORE any other imports that read os.environ
load_dotenv()
from fastapi.responses import StreamingResponse

# Add backend dir to path so relative imports work when run from project root
sys.path.insert(0, os.path.dirname(__file__))

from models import (
    EvaluationJobResponse,
    EvaluationRequest,
    FinalConsensusReport,
    JobStatusResponse,
    StreamProgressEvent,
    EvaluationSettings,
)
from services.evaluators import run_evaluation_pipeline
from services.preprocessor import preprocess_draft
from services.rubric_parser import parse_rubric
from utils.document_loader import extract_text_from_upload
from utils.job_store import job_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialise the persistent job store and start cleanup on app startup."""
    await job_store.init_db()
    cleanup_task = asyncio.create_task(job_store.run_cleanup_loop(interval_seconds=300))
    logger.info("RubricJudge API starting up.")
    yield
    cleanup_task.cancel()
    await job_store.close()
    logger.info("RubricJudge API shutting down.")


app = FastAPI(
    title="RubricJudge API",
    description="Multi-agent AI-powered academic assignment evaluation platform.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error_code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": "HTTP_ERROR", "message": str(exc.detail), "resolution": "Please verify your request parameters."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error_code": "INTERNAL_SERVER_ERROR", "message": str(exc), "resolution": "An unexpected error occurred. Please try again later."}
    )


# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

def _sse_format(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, default=str)}\n\n"


async def _push_progress(
    job_id: str,
    stage: str,
    progress: int,
    message: str,
    agent: Optional[str] = None,
    result: Optional[FinalConsensusReport] = None,
    error: Optional[str] = None,
) -> None:
    """Build a StreamProgressEvent and push it to the job queue."""
    event = StreamProgressEvent(
        job_id=job_id,
        stage=stage,  # type: ignore[arg-type]
        progress_percentage=progress,
        active_agent=agent,
        message=message,
        result=result,
        error=error,
    )
    await job_store.push_event(job_id, event.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Background evaluation task
# ---------------------------------------------------------------------------

async def _run_pipeline(
    job_id: str,
    draft_text: str,
    rubric_text: str,
    assignment_title: Optional[str],
    settings: Optional[EvaluationSettings] = None,
) -> None:
    """Full 4-phase pipeline executed as a background asyncio task."""
    try:
        await job_store.set_status(job_id, "running")

        # Phase 1a: Parse rubric
        await _push_progress(job_id, "parsing_rubric", 10, "Parsing and normalising rubric...")
        rubric = await parse_rubric(rubric_text, assignment_title)
        await _push_progress(
            job_id, "parsing_rubric", 20,
            f"Rubric parsed: {len(rubric.criteria)} criteria detected.",
        )

        # Phase 1b: Deterministic pre-processing
        await _push_progress(job_id, "preflight_checks", 25, "Running preflight checks on draft...")
        stats = preprocess_draft(draft_text)
        await _push_progress(
            job_id, "preflight_checks", 35,
            f"Draft metrics: {stats.word_count} words, {stats.citation_count} citations detected.",
        )

        # Phase 2: Parallel specialist judges
        async def _progress_callback(stage: str, message: str, agent: Optional[str] = None):
            progress_map = {
                "running_specialist_judges": 55,
                "arbitrating_discrepancies": 80,
                "generating_final_report": 90,
            }
            pct = progress_map.get(stage, 55)
            await _push_progress(job_id, stage, pct, message, agent=agent)  # type: ignore[arg-type]

        await _push_progress(
            job_id, "running_specialist_judges", 40,
            "Launching specialist judge committee (Agent A, B, C)...",
        )

        report = await run_evaluation_pipeline(
            rubric=rubric,
            draft_text=draft_text,
            stats=stats,
            job_id=job_id,
            settings=settings,
            progress_callback=_progress_callback,
        )

        # Phase 4: Done
        await job_store.set_result(job_id, report)
        await _push_progress(
            job_id, "completed", 100,
            "Evaluation complete. Report ready.",
            result=report,
        )

    except asyncio.CancelledError:
        logger.info("Job %s cancelled (client disconnected).", job_id)
        await job_store.set_status(job_id, "failed")
    except Exception as exc:
        logger.exception("Pipeline error for job %s: %s", job_id, exc)
        await job_store.set_status(job_id, "failed")
        
        error_msg = str(exc)
        if "429" in error_msg or "rate limit" in error_msg.lower() or "quota" in error_msg.lower() or "exhausted" in error_msg.lower():
            error_msg = "Google GenAI API rate limit exceeded. Please wait a moment and try again."
        elif "timeout" in error_msg.lower() or "connection" in error_msg.lower():
            error_msg = "Connection to the AI service timed out. The evaluation was too complex or the service is busy. Please try again."
        elif "400" in error_msg or "safety" in error_msg.lower() or "blocked" in error_msg.lower():
            error_msg = "The evaluation was blocked due to safety settings or unsupported content. Please revise your documents."
            
        await _push_progress(
            job_id, "failed", 0,
            f"Evaluation failed: {error_msg}",
            error=error_msg,
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/evaluate", response_model=EvaluationJobResponse, status_code=202)
async def start_evaluation(
    background_tasks: BackgroundTasks,
    draft_text: Optional[str] = Form(None),
    rubric_text: Optional[str] = Form(None),
    assignment_title: Optional[str] = Form(None),
    settings: Optional[str] = Form(None),
    draft_file: Optional[UploadFile] = File(None),
    rubric_file: Optional[UploadFile] = File(None),
) -> EvaluationJobResponse:
    """
    Accept a draft + rubric (as raw text or uploaded PDF/DOCX) and start
    the multi-agent evaluation pipeline asynchronously.

    Returns a job_id and SSE stream URL immediately.
    """
    # Resolve draft text
    resolved_draft = draft_text or ""
    if not resolved_draft and draft_file:
        content = await draft_file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail={"error_code": "FILE_TOO_LARGE", "message": "Draft file exceeds the 25MB limit.", "resolution": "Please upload a smaller file."})
        try:
            resolved_draft = extract_text_from_upload(draft_file.filename or "upload.txt", content)
        except ValueError as e:
            raise HTTPException(status_code=422, detail={"error_code": "INVALID_FILE", "message": str(e), "resolution": "Please ensure your file is a valid PDF, DOCX, or TXT."})

    # Resolve rubric text
    resolved_rubric = rubric_text or ""
    if not resolved_rubric and rubric_file:
        content = await rubric_file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail={"error_code": "FILE_TOO_LARGE", "message": "Rubric file exceeds the 25MB limit.", "resolution": "Please upload a smaller file."})
        try:
            resolved_rubric = extract_text_from_upload(rubric_file.filename or "upload.txt", content)
        except ValueError as e:
            raise HTTPException(status_code=422, detail={"error_code": "INVALID_FILE", "message": str(e), "resolution": "Please ensure your file is a valid PDF, DOCX, or TXT."})

    if not resolved_draft:
        raise HTTPException(status_code=422, detail={"error_code": "MISSING_DRAFT", "message": "Draft text or file is required.", "resolution": "Please upload or paste your assignment draft."})
    if not resolved_rubric:
        raise HTTPException(status_code=422, detail={"error_code": "MISSING_RUBRIC", "message": "Rubric text or file is required.", "resolution": "Please upload or paste your evaluation rubric."})
    if len(resolved_draft.split()) < 30:
        raise HTTPException(
            status_code=422,
            detail={"error_code": "DRAFT_TOO_SHORT", "message": "The uploaded document contains unreadable or scanned image text, or is too short.", "resolution": "Please upload a standard digital document or convert it to DOCX."}
        )

    parsed_settings = None
    if settings:
        try:
            parsed_settings = EvaluationSettings.model_validate_json(settings)
        except Exception as e:
            logger.warning("Failed to parse settings: %s", e)

    job_id = await job_store.create_job()
    logger.info("Created job %s (%d word draft, %d char rubric).", job_id, len(resolved_draft.split()), len(resolved_rubric))

    # Launch evaluation as a monitored background task
    task = asyncio.create_task(
        _run_pipeline(job_id, resolved_draft, resolved_rubric, assignment_title, parsed_settings)
    )
    job_store.register_task(job_id, task)

    return EvaluationJobResponse(
        job_id=job_id,
        stream_url=f"/api/evaluate/stream/{job_id}",
    )


@app.get("/api/evaluate/stream/{job_id}")
async def stream_evaluation(job_id: str, request: Request) -> StreamingResponse:
    """
    Server-Sent Events endpoint. Streams progress events until the
    evaluation completes or the client disconnects.

    On disconnect, the background evaluation task is cancelled to avoid
    wasting API tokens.
    """
    if not await job_store.job_exists(job_id):
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    queue = job_store.get_queue(job_id)
    if queue is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' queue missing.")

    async def _event_generator() -> AsyncIterator[str]:
        try:
            # Keep-alive comment every 15 s to prevent nginx/proxy timeouts
            while True:
                if await request.is_disconnected():
                    logger.info("SSE client disconnected for job %s -- cancelling task.", job_id)
                    job_store.cancel_job(job_id)
                    return

                try:
                    event_data = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue

                yield _sse_format(event_data)

                # Stop streaming after terminal events
                if event_data.get("stage") in ("completed", "failed"):
                    return
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Connection": "keep-alive",
        },
    )


@app.get("/api/jobs/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str) -> JobStatusResponse:
    """Quick polling endpoint for clients that can't use SSE."""
    if not await job_store.job_exists(job_id):
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    status = await job_store.get_status(job_id) or "pending"
    result_data = await job_store.get_result(job_id)

    # Reconstruct the FinalConsensusReport from stored JSON if available.
    result_obj = None
    if result_data:
        try:
            result_obj = FinalConsensusReport.model_validate(result_data)
        except Exception:
            logger.warning("Could not deserialise stored result for job %s.", job_id)

    return JobStatusResponse(
        job_id=job_id,
        status=status,  # type: ignore[arg-type]
        result=result_obj,
        created_at=await job_store.get_created_at(job_id),
        updated_at=await job_store.get_updated_at(job_id),
    )


@app.get("/api/health")
async def health_check() -> dict:
    return {"status": "ok", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# Dev server entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
