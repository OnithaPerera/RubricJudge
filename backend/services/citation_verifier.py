import asyncio
import logging
import re
import urllib.parse
from typing import List, Optional

import httpx
from models import CitationAuditReport, CitationValidationItem, EvaluationSettings
from services.llm_client import llm_json_call

logger = logging.getLogger(__name__)

# Regex to extract DOI: matches 10.xxxx/xxxx...
DOI_PATTERN = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)

async def _verify_doi(doi: str, semaphore: asyncio.Semaphore) -> bool:
    """Check if a DOI is active using the Crossref API."""
    safe_doi = urllib.parse.quote(doi.strip(), safe="")
    url = f"https://api.crossref.org/works/{safe_doi}"
    headers = {
        "User-Agent": "RubricJudge/1.0 (https://rubricjudge.app; mailto:support@rubricjudge.app)"
    }
    try:
        async with semaphore:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, headers=headers)
                return response.status_code == 200
    except Exception as e:
        logger.warning(f"Error verifying DOI {doi}: {e}")
        return False

async def run_citation_audit(draft_text: str, settings: EvaluationSettings) -> CitationAuditReport:
    """
    Asynchronously verify DOIs and audit citation formatting via an LLM call.
    """
    logger.info("Starting citation audit...")
    
    # Extract DOIs and strip trailing punctuation like periods or commas
    raw_dois = DOI_PATTERN.findall(draft_text)
    extracted_dois = list(set([doi.rstrip(".,;:?") for doi in raw_dois]))
    active_dois_verified = 0
    broken_dois_found = 0
    doi_statuses = {}
    
    if settings.verify_dois and extracted_dois:
        logger.info(f"Verifying {len(extracted_dois)} DOIs...")
        semaphore = asyncio.Semaphore(5)
        tasks = [_verify_doi(doi, semaphore) for doi in extracted_dois]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for doi, is_active in zip(extracted_dois, results):
            if isinstance(is_active, bool) and is_active:
                active_dois_verified += 1
                doi_statuses[doi] = True
            else:
                broken_dois_found += 1
                doi_statuses[doi] = False

    # Perform LLM audit for cross-referencing and style formatting
    system_prompt = f"""You are a strict academic auditor evaluating a student's submission.
Your task is to identify all in-text citations and reference list entries, cross-reference them, and audit their formatting against {settings.referencing_style} style.

Instructions:
1. Identify all references in the bibliography.
2. Identify all in-text citations in the body text.
3. Compare the two lists to find 'orphan_references' (in bibliography but not cited in text) and 'missing_in_text_citations' (cited in text but not in bibliography).
4. For each reference list entry, evaluate its formatting according to {settings.referencing_style}. Provide a critique and the correct suggested format.
5. If a DOI is present in the entry, extract it.

Output must match the requested JSON schema.
"""
    
    # We pass the draft text and the DOI status map to the LLM to integrate it
    user_message = f"""
<draft>
{draft_text}
</draft>

<doi_verification_results>
{doi_statuses}
</doi_verification_results>
"""
    
    # Define a temporary BaseModel for the LLM response if needed, 
    # but we can just use CitationAuditReport directly since it matches.
    try:
        report = await llm_json_call(
            system_prompt=system_prompt,
            user_message=user_message,
            response_model=CitationAuditReport,
            temperature=0.1
        )
        # Update DOI counts from our hard verification
        report.active_dois_verified = active_dois_verified
        report.broken_dois_found = broken_dois_found
        
        # Override the LLM's DOI validity with our actual HTTP check
        for item in report.items:
            if item.doi and item.doi in doi_statuses:
                item.doi_valid = doi_statuses[item.doi]
                if not item.doi_valid:
                    item.doi_error_message = "DOI could not be resolved via Crossref."
                
        return report
    except Exception as e:
        logger.error(f"Citation audit failed: {e}")
        # Return an empty report on failure
        return CitationAuditReport(
            referencing_style=settings.referencing_style,
            total_citations_found=0,
            active_dois_verified=active_dois_verified,
            broken_dois_found=broken_dois_found,
            orphan_references=[],
            missing_in_text_citations=[],
            items=[]
        )
