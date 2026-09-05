"""
RubricJudge — Deterministic Pre-Processor (Phase 1, non-LLM)

Computes hard metrics from the draft text before any LLM is invoked:
- Word count, paragraph count, sentence count
- Section header detection (Markdown ## or Title Case lines)
- Citation density (APA, MLA, numbered references)
- Logical section segmentation for token budgeting in downstream agents
"""
from __future__ import annotations

import re
from typing import List

from models import DeterministicStats


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# APA-style:  (Author, 2024) or (Author et al., 2024)
_RE_APA = re.compile(r"\([A-Z][a-zA-Z]+(?:\s+et\s+al\.)?[,.]?\s+\d{4}\)")
# MLA-style:  (Author 24) or (Author page)
_RE_MLA = re.compile(r"\([A-Z][a-zA-Z]+\s+\d+\)")
# Numbered:   [1], [12], [1,2], [1-3]
_RE_NUMBERED = re.compile(r"\[\d[\d,\-\s]*\]")
# Footnote superscripts: ¹ ² ³ or ^1 ^2
_RE_SUPER = re.compile(r"[\u00B9\u00B2\u00B3\u2074-\u2079]|\^[0-9]+")
# DOI
_RE_DOI = re.compile(r"doi:\s*10\.\d{4,}/\S+", re.IGNORECASE)
# URL refs
_RE_URL = re.compile(r"https?://[^\s,]+")

# Markdown headers or ALL-CAPS / Title Case single-line paragraphs
_RE_HEADER = re.compile(
    r"^(?:#{1,6}\s+.+|[A-Z][A-Za-z\s]{3,50}:?\s*)$", re.MULTILINE
)

# Common academic section names
_SECTION_KEYWORDS = [
    "abstract", "introduction", "background", "literature review",
    "methodology", "methods", "results", "discussion", "conclusion",
    "references", "appendix", "related work", "analysis", "findings",
]

# Sentence boundary (simplified)
_RE_SENTENCE = re.compile(r"[.!?]+\s+")


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------

def preprocess_draft(draft_text: str) -> DeterministicStats:
    """
    Compute deterministic (non-LLM) metrics for the submission draft.

    Returns:
        DeterministicStats populated with all computed values.
    """
    # --- Basic counts ---
    words = draft_text.split()
    word_count = len(words)

    raw_paragraphs = [p.strip() for p in re.split(r"\n{2,}", draft_text) if p.strip()]
    paragraph_count = len(raw_paragraphs)

    sentences = _RE_SENTENCE.split(draft_text)
    sentence_count = max(len([s for s in sentences if s.strip()]), 1)

    avg_words_per_sentence = round(word_count / sentence_count, 1)

    # --- Header detection ---
    header_matches = _RE_HEADER.findall(draft_text)
    has_section_headers = len(header_matches) >= 2  # at least 2 header-like lines

    # --- Section detection ---
    sections_detected: List[str] = []
    lower_text = draft_text.lower()
    for keyword in _SECTION_KEYWORDS:
        # Look for keyword at the start of a line or as a standalone heading
        pattern = rf"(?m)^\s*{re.escape(keyword)}[:\s]*$"
        if re.search(pattern, lower_text):
            sections_detected.append(keyword.title())
    # Deduplicate preserving order
    seen = set()
    sections_detected = [
        s for s in sections_detected if not (s in seen or seen.add(s))  # type: ignore[func-returns-value]
    ]

    # --- Citation counting ---
    all_citations: List[str] = []
    all_citations.extend(_RE_APA.findall(draft_text))
    all_citations.extend(_RE_MLA.findall(draft_text))
    all_citations.extend(_RE_NUMBERED.findall(draft_text))
    all_citations.extend(_RE_SUPER.findall(draft_text))
    all_citations.extend(_RE_DOI.findall(draft_text))
    # Count unique URLs only in a References section context
    if "references" in lower_text or "bibliography" in lower_text:
        all_citations.extend(_RE_URL.findall(draft_text))

    citation_count = len(all_citations)
    citation_density = round(citation_count / max(word_count, 1) * 1000, 2)

    return DeterministicStats(
        word_count=word_count,
        paragraph_count=paragraph_count,
        sentence_count=sentence_count,
        has_section_headers=has_section_headers,
        citation_count=citation_count,
        citation_density=citation_density,
        avg_words_per_sentence=avg_words_per_sentence,
        sections_detected=sections_detected,
    )


def segment_draft(draft_text: str, max_chunk_words: int = 1500) -> List[str]:
    """
    Split long drafts into logical chunks for token budgeting.

    Tries to split on detected section boundaries first; falls back to
    paragraph-level chunking if no headers are found.

    Args:
        draft_text:      Full submission text.
        max_chunk_words: Soft word-count ceiling per chunk.

    Returns:
        List of text chunks (may be the full text in a single-item list
        for short assignments).
    """
    # Try splitting on Markdown headers or blank-line-separated ALL-CAPS lines
    header_pattern = re.compile(r"(?m)^(?:#{1,6}\s+.+|[A-Z][A-Za-z\s]{3,50}:?)\s*$")
    splits = header_pattern.split(draft_text)

    if len(splits) > 1:
        chunks: List[str] = []
        current_chunk: List[str] = []
        current_words = 0
        for segment in splits:
            seg_words = len(segment.split())
            if current_words + seg_words > max_chunk_words and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [segment]
                current_words = seg_words
            else:
                current_chunk.append(segment)
                current_words += seg_words
        if current_chunk:
            chunks.append("\n\n".join(current_chunk))
        return [c.strip() for c in chunks if c.strip()]

    # Fallback: paragraph-level chunking
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", draft_text) if p.strip()]
    chunks = []
    current: List[str] = []
    current_words = 0
    for para in paragraphs:
        para_words = len(para.split())
        if current_words + para_words > max_chunk_words and current:
            chunks.append("\n\n".join(current))
            current = [para]
            current_words = para_words
        else:
            current.append(para)
            current_words += para_words
    if current:
        chunks.append("\n\n".join(current))
    return chunks or [draft_text]
