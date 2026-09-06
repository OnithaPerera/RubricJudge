"""
RubricJudge -- Pydantic v2 Data Contracts (Phase 1 Refactor)

All request/response schemas, streaming event payloads, and agent data models.
Character offsets in EvidenceQuote are computed deterministically by Python's
str.find(), never guessed by the LLM.
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
    # List of level descriptors, e.g. Poor / Satisfactory / Excellent.
    levels: List[CriterionLevel] = Field(default_factory=list)
    # Inferred category for agent weighting matrix.
    category: Literal[
        "content_argumentation",
        "structure_formatting",
        "task_fulfillment",
        "other",
    ] = "other"

    @field_validator("levels", mode="before")
    @classmethod
    def convert_levels(cls, v: Any) -> Any:
        """Accept dict {label: description} and convert to list of CriterionLevel."""
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
# Pre-Processor (deterministic, no LLM)
# ---------------------------------------------------------------------------

class DeterministicStats(BaseModel):
    """Hard metrics computed without calling any LLM."""
    word_count: int
    paragraph_count: int
    sentence_count: int
    has_section_headers: bool
    citation_count: int
    citation_density: float          # citations per 1,000 words
    avg_words_per_sentence: float
    sections_detected: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Evidence Quoting (deterministic char-offset verification)
# ---------------------------------------------------------------------------

class EvidenceQuote(BaseModel):
    """
    A verbatim quote extracted from the student draft with verified character
    offsets. The LLM returns only quote_text; char_start and char_end are
    computed server-side using Python's str.find() for deterministic accuracy.
    """
    quote_text: str
    char_start: int = Field(
        default=-1,
        description=(
            "0-indexed start position in the draft text. "
            "-1 means the quote could not be located in the draft."
        ),
    )
    char_end: int = Field(
        default=-1,
        description=(
            "0-indexed exclusive end position in the draft text. "
            "-1 means the quote could not be located in the draft."
        ),
    )
    confidence_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description=(
            "1.0 = exact match found, 0.7 = normalised match, "
            "0.0 = quote not found in draft."
        ),
    )
    context_note: str = Field(
        default="",
        description="Optional note describing why this passage was cited as evidence.",
    )


# ---------------------------------------------------------------------------
# Per-Agent Scoring (raw LLM output before reconciliation)
# ---------------------------------------------------------------------------

class CriterionScore(BaseModel):
    """Score awarded to a single criterion by a single judge agent."""
    criterion_id: str
    criterion_title: str = Field(default="")
    score: float
    max_score: float
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    # Raw quote strings from the LLM. Char offsets are computed in post-processing.
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
# Reconciled / Consensus Scoring (Phase 1 Refactor)
# ---------------------------------------------------------------------------

class CriterionEvaluation(BaseModel):
    """
    Consensus evaluation for a single rubric criterion, incorporating
    multi-agent jury scores, optional arbitration when variance exceeds
    15%, and deterministic evidence quotes with character offsets.
    """
    criterion_id: str
    criterion_title: str
    assigned_score: float
    max_score: float
    percentage: float = Field(
        default=0.0,
        description="assigned_score / max_score * 100, rounded to 1 decimal.",
    )
    # Individual raw scores from each judge keyed by agent name.
    jury_scores: Dict[str, float] = Field(default_factory=dict)
    was_arbitrated: bool = False
    arbitration_notes: Optional[str] = None
    # Verified evidence with character offsets.
    evidence: List[EvidenceQuote] = Field(default_factory=list)
    critique: str = ""
    # Guiding questions only, never replacement text.
    actionable_questions: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)
    is_advisory: bool = False


# ---------------------------------------------------------------------------
# Final Report (Phase 1 Refactor)
# ---------------------------------------------------------------------------

class FinalConsensusReport(BaseModel):
    """
    The authoritative, student-facing evaluation report.
    Preserves the rubric's native score scale (raw_points / max_possible_points)
    and also reports a normalised overall_percentage.
    """
    raw_points: float
    max_possible_points: float
    overall_percentage: float = Field(
        description="raw_points / max_possible_points * 100, rounded to 1 decimal.",
    )
    letter_grade: str
    deterministic_stats: DeterministicStats
    criteria_breakdown: List[CriterionEvaluation]
    consensus_discrepancies: List[str] = Field(default_factory=list)
    top_strengths: List[str] = Field(default_factory=list)
    priority_revisions: List[str] = Field(default_factory=list)
    guiding_questions_for_revision: List[str] = Field(default_factory=list)
    agents_used: List[str] = Field(default_factory=list)
    disclaimer: str = (
        "This is a diagnostic estimate only. "
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
    # Only populated on the final "completed" event.
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
    """Immediate response from POST /api/evaluate. Contains the job ID for SSE polling."""
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


# ---------------------------------------------------------------------------
# Quote Verification Utilities
# ---------------------------------------------------------------------------

def verify_evidence_quotes(
    raw_quotes: List[str],
    draft_text: str,
    context_note: str = "",
) -> List[EvidenceQuote]:
    """
    Take raw quote strings returned by an LLM and verify each one against
    the draft text using deterministic string matching.

    Matching strategy (per quote):
      1. Exact match via str.find() -> confidence 1.0
      2. Whitespace-normalised match -> confidence 0.7
      3. No match found -> confidence 0.0, offsets set to -1

    Args:
        raw_quotes:   List of verbatim quote strings from the LLM.
        draft_text:   The full student submission text.
        context_note: Optional note to attach to all quotes in this batch.

    Returns:
        List of EvidenceQuote with verified character offsets.
    """
    import re

    results: List[EvidenceQuote] = []
    for quote in raw_quotes:
        quote = quote.strip()
        if not quote:
            continue

        # Strategy 1: Exact match
        idx = draft_text.find(quote)
        if idx >= 0:
            results.append(EvidenceQuote(
                quote_text=quote,
                char_start=idx,
                char_end=idx + len(quote),
                confidence_score=1.0,
                context_note=context_note,
            ))
            continue

        # Strategy 2: Whitespace-normalised match
        # Collapse all whitespace runs to single spaces in both the quote
        # and the draft, then search.
        normalised_quote = re.sub(r"\s+", " ", quote).strip()
        normalised_draft = re.sub(r"\s+", " ", draft_text).strip()

        norm_idx = normalised_draft.find(normalised_quote)
        if norm_idx >= 0:
            # Map the normalised index back to the original draft.
            # Walk through the original draft counting characters while
            # skipping extra whitespace to find the true start position.
            original_start = _map_normalised_offset_to_original(
                draft_text, norm_idx
            )
            # For the end offset, find the quote length in the original text
            # by scanning forward from original_start.
            original_end = _find_original_end(
                draft_text, original_start, normalised_quote
            )
            results.append(EvidenceQuote(
                quote_text=quote,
                char_start=original_start,
                char_end=original_end,
                confidence_score=0.7,
                context_note=context_note,
            ))
            continue

        # Strategy 3: Case-insensitive normalised match
        norm_idx_lower = normalised_draft.lower().find(normalised_quote.lower())
        if norm_idx_lower >= 0:
            original_start = _map_normalised_offset_to_original(
                draft_text, norm_idx_lower
            )
            original_end = _find_original_end(
                draft_text, original_start, normalised_quote
            )
            results.append(EvidenceQuote(
                quote_text=quote,
                char_start=original_start,
                char_end=original_end,
                confidence_score=0.5,
                context_note=context_note,
            ))
            continue

        # Strategy 4: Not found
        results.append(EvidenceQuote(
            quote_text=quote,
            char_start=-1,
            char_end=-1,
            confidence_score=0.0,
            context_note=context_note,
        ))

    return results


def _map_normalised_offset_to_original(original: str, normalised_offset: int) -> int:
    """
    Given an offset into a whitespace-normalised version of `original`,
    return the corresponding offset in the original string.

    The normalised string collapses all whitespace runs to single spaces
    and strips leading/trailing whitespace.
    """
    import re

    # Walk through the original string, tracking how many "normalised"
    # characters we have consumed.
    norm_count = 0
    i = 0
    length = len(original)

    # Skip leading whitespace (mirrors the .strip() in normalisation)
    while i < length and original[i] in " \t\n\r":
        i += 1

    in_whitespace = False
    while i < length and norm_count < normalised_offset:
        ch = original[i]
        if ch in " \t\n\r":
            if not in_whitespace:
                # This whitespace run counts as one space in normalised form.
                norm_count += 1
                in_whitespace = True
        else:
            norm_count += 1
            in_whitespace = False
        i += 1

    # If we ended inside a whitespace run, advance past remaining whitespace
    # to reach the next non-whitespace char (the actual content position).
    if in_whitespace:
        while i < length and original[i] in " \t\n\r":
            i += 1

    return i


def _find_original_end(original: str, start: int, normalised_quote: str) -> int:
    """
    Starting at `start` in `original`, consume characters that match the
    normalised_quote (ignoring extra whitespace) and return the exclusive
    end offset in the original string.
    """
    quote_idx = 0
    i = start
    length = len(original)
    quote_len = len(normalised_quote)

    while i < length and quote_idx < quote_len:
        orig_ch = original[i]
        quote_ch = normalised_quote[quote_idx]

        if quote_ch == " ":
            # The normalised quote has a space here. The original may have
            # one or more whitespace chars. Consume all of them.
            if orig_ch in " \t\n\r":
                while i < length and original[i] in " \t\n\r":
                    i += 1
                quote_idx += 1
            else:
                # Mismatch: original has no whitespace where expected.
                break
        else:
            if orig_ch.lower() == quote_ch.lower():
                i += 1
                quote_idx += 1
            else:
                # Character mismatch.
                break

    return i
