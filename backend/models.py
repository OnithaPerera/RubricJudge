"""
RubricJudge — Pydantic v2 Data Contracts
All request/response schemas, streaming event payloads, and agent data models.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Rubric Structures
# ---------------------------------------------------------------------------

class CriterionLevel(BaseModel):
    """A qualitative level descriptor for a rubric criterion."""
    label: str
    description: str


class RubricCriterion(BaseModel):
    """A single graded criterion extracted from the rubric."""
    id: str
    title: str
    description: str
    weight_percentage: float = Field(default=0.0, ge=0.0, le=100.0)
    max_score: float = Field(default=10.0, ge=0.0)
    # e.g. [{"label": "Poor", "description": "Lacks..."}, {"label": "Excellent", "description": "Exceeds..."}]
    levels: List[CriterionLevel] = Field(default_factory=list)
    # Inferred category for agent weighting matrix
    category: Literal[
        "content_argumentation",
        "structure_formatting",
        "task_fulfillment",
        "other",
    ] = "other"

    @field_validator("levels", mode="before")
    @classmethod
    def convert_levels(cls, v: Any) -> Any:
        if isinstance(v, dict):
            return [CriterionLevel(label=str(k), description=str(val)) for k, val in v.items()]
        return v


class NormalizedRubric(BaseModel):
    """Parsed and normalised version of the user-submitted rubric."""
    assignment_title: Optional[str] = "Assignment"
    total_points: float = 100.0
    criteria: List[RubricCriterion]

    @field_validator("criteria")
    @classmethod
    def at_least_one_criterion(cls, v: List[RubricCriterion]) -> List[RubricCriterion]:
        if not v:
            raise ValueError("Rubric must contain at least one criterion.")
        return v



# ---------------------------------------------------------------------------
# Pre-Processor
# ---------------------------------------------------------------------------

class DeterministicStats(BaseModel):
    """Hard metrics computed without calling any LLM."""
    word_count: int
    paragraph_count: int
    sentence_count: int
    has_section_headers: bool
    citation_count: int
    citation_density: float          # citations per 1 000 words
    avg_words_per_sentence: float
    sections_detected: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Per-Agent Scoring
# ---------------------------------------------------------------------------

class CriterionScore(BaseModel):
    """Score awarded to a single criterion by a single judge agent."""
    criterion_id: str
    criterion_title: str = Field(default="")
    score: float
    max_score: float
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    evidence_quotes: List[str] = Field(default_factory=list)
    critique: str = Field(default="")
    suggestions: List[str] = Field(default_factory=list)



class AgentEvaluationResult(BaseModel):
    """Full output from one specialist judge agent."""
    agent_name: str
    criterion_scores: List[CriterionScore]
    overall_notes: str
    failed: bool = False          # True if the agent errored out permanently
    error_message: Optional[str] = None


# ---------------------------------------------------------------------------
# Reconciled / Consensus Scoring
# ---------------------------------------------------------------------------

class ReconciledCriterionScore(BaseModel):
    """
    Consensus score for a criterion, incorporating multi-agent weighting
    and optional arbitration when variance exceeds 20 %.
    """
    criterion_id: str
    criterion_title: str
    final_score: float
    max_score: float
    percentage: float
    # Individual raw scores from each judge
    agent_scores: Dict[str, float] = Field(default_factory=dict)
    was_reconciled: bool = False
    arbitration_reasoning: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    evidence_quotes: List[str] = Field(default_factory=list)
    critique: str = ""
    # Guiding questions only — never replacement text
    actionable_revision_prompts: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Final Report
# ---------------------------------------------------------------------------

class FinalConsensusReport(BaseModel):
    """The authoritative, student-facing evaluation report."""
    estimated_overall_score: float
    max_possible_score: float
    percentage: float
    letter_grade: str
    deterministic_stats: DeterministicStats
    criteria_breakdown: List[ReconciledCriterionScore]
    consensus_discrepancies: List[str] = Field(default_factory=list)
    top_strengths: List[str] = Field(default_factory=list)
    priority_improvements: List[str] = Field(default_factory=list)
    guiding_questions_for_revision: List[str] = Field(default_factory=list)
    agents_used: List[str] = Field(default_factory=list)
    disclaimer: str = (
        "⚠️ This is a diagnostic estimate only. "
        "Scores are AI-generated and do not constitute official academic assessment."
    )


# ---------------------------------------------------------------------------
# SSE / Streaming Events
# ---------------------------------------------------------------------------

class StreamProgressEvent(BaseModel):
    """Server-Sent Event payload pushed to the frontend during evaluation."""
    job_id: str
    stage: Literal[
        "parsing_rubric",
        "preflight_checks",
        "running_specialist_judges",
        "arbitrating_discrepancies",
        "generating_final_report",
        "completed",
        "failed",
    ]
    progress_percentage: int = Field(ge=0, le=100)
    active_agent: Optional[str] = None
    message: str
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    # Only populated on the final "completed" event
    result: Optional[FinalConsensusReport] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# API Request / Response
# ---------------------------------------------------------------------------

class EvaluationRequest(BaseModel):
    """Body for POST /api/evaluate when using raw text (non-file) input."""
    draft_text: str = Field(min_length=50)
    rubric_text: str = Field(min_length=20)
    assignment_title: Optional[str] = None


class EvaluationJobResponse(BaseModel):
    """Immediate response from POST /api/evaluate — contains the job ID for SSE polling."""
    job_id: str
    message: str = "Evaluation started. Connect to the SSE stream for progress updates."
    stream_url: str


class JobStatusResponse(BaseModel):
    """Optional polling endpoint response."""
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    result: Optional[FinalConsensusReport] = None
    created_at: float
    updated_at: float
