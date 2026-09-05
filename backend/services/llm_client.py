"""
RubricJudge — Async LLM Client

Provides a unified async interface supporting:
  - Google Gemini (free tier via google-genai SDK)  ← DEFAULT
  - OpenAI GPT-4o
  - Anthropic Claude (with prompt caching)
  - Ollama (local fallback)

Key features:
- Structured JSON outputs via each provider's native schema mechanism.
- Per-request exponential backoff with jitter on rate-limit and transient errors.
- Prompt injection hardening: all user inputs are wrapped in XML delimiters.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
from typing import Any, Optional, Type, TypeVar

from dotenv import load_dotenv
from pydantic import BaseModel

# Always load .env so standalone scripts and worker processes have active values
load_dotenv(override=False)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# ---------------------------------------------------------------------------
# Lazy Environment Variable Getters
# ---------------------------------------------------------------------------

def get_gemini_model() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

def get_openai_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4o")

def get_anthropic_model() -> str:
    return os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

def get_ollama_model() -> str:
    return os.getenv("OLLAMA_MODEL", "llama3")

def get_ollama_base_url() -> str:
    return os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")

def get_llm_provider() -> str:
    return os.getenv("LLM_PROVIDER", "gemini").strip().lower()

def get_max_retries() -> int:
    return int(os.getenv("LLM_MAX_RETRIES", "3"))

def get_base_backoff() -> float:
    return float(os.getenv("LLM_BASE_BACKOFF", "2.0"))


# Legacy constants (fallback aliases)
GEMINI_MODEL = get_gemini_model()
DEFAULT_MODEL = get_openai_model()
ANTHROPIC_MODEL = get_anthropic_model()
OLLAMA_MODEL = get_ollama_model()
OLLAMA_BASE_URL = get_ollama_base_url()
MAX_RETRIES = get_max_retries()
BASE_BACKOFF = get_base_backoff()
LLM_PROVIDER = get_llm_provider()


# ---------------------------------------------------------------------------
# JSON extraction helper (safety net for markdown-wrapped responses)
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> Any:
    """
    Extract JSON from an LLM response that may be wrapped in markdown
    code fences (```json ... ```) or contain trailing commentary.
    """
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Strip markdown fences
    fence_match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # Last resort: find the first { ... } or [ ... ] block
    brace_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(1))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from LLM response:\n{text[:500]}")


# ---------------------------------------------------------------------------
# Retry decorator
# ---------------------------------------------------------------------------

async def _with_retry(coro_fn, *args, max_retries: Optional[int] = None, **kwargs):
    """Retry an async callable with exponential backoff + jitter."""
    limit = max_retries if max_retries is not None else get_max_retries()
    base_backoff = get_base_backoff()
    last_exc: Optional[Exception] = None
    for attempt in range(limit + 1):
        try:
            return await coro_fn(*args, **kwargs)
        except Exception as exc:
            last_exc = exc
            err_str = str(exc).lower()
            # Don't retry on auth or validation errors
            if any(k in err_str for k in ("authentication", "invalid_api_key", "permission")):
                raise
            if attempt < limit:
                wait = base_backoff ** attempt + random.uniform(0, 1)
                logger.warning(
                    "LLM call failed (attempt %d/%d): %s. Retrying in %.1fs…",
                    attempt + 1, limit, exc, wait,
                )
                await asyncio.sleep(wait)
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Gemini client (google-genai SDK)
# ---------------------------------------------------------------------------

FALLBACK_GEMINI_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
]

async def _call_gemini(
    system_prompt: str,
    user_message: str,
    response_schema: Optional[Any] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> str:
    """
    Call Google Gemini using the google-genai 2.x native async client.
    Uses JSON response_mime_type and response_schema for strict structured output.
    Automatically fails over to alternative flash models if 429 quota is reached.
    """
    from google import genai  # type: ignore
    from google.genai import types as genai_types  # type: ignore

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. "
            "Get a free key at https://aistudio.google.com/apikey"
        )

    primary_model = model or get_gemini_model()
    # List models to try: primary model first, followed by available fallbacks
    models_to_try = [primary_model] + [m for m in FALLBACK_GEMINI_MODELS if m != primary_model]

    client = genai.Client(api_key=api_key)

    config_kwargs: dict[str, Any] = {
        "temperature": temperature,
        "system_instruction": system_prompt,
    }
    if response_schema is not None:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = response_schema

    generation_config = genai_types.GenerateContentConfig(**config_kwargs)

    last_error: Optional[Exception] = None
    for attempt_model in models_to_try:
        try:
            response = await client.aio.models.generate_content(
                model=attempt_model,
                contents=user_message,
                config=generation_config,
            )
            return response.text
        except Exception as exc:
            err_str = str(exc).lower()
            if "resource_exhausted" in err_str or "429" in err_str or "quota" in err_str:
                logger.warning(
                    "Gemini quota exhausted for model '%s'. Failing over to next model…",
                    attempt_model,
                )
                last_error = exc
                continue
            raise exc

    if last_error:
        raise last_error
    raise RuntimeError("No Gemini models available.")




# ---------------------------------------------------------------------------
# OpenAI client
# ---------------------------------------------------------------------------

async def _call_openai(
    system_prompt: str,
    user_message: str,
    response_schema: Optional[dict] = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
) -> str:
    from openai import AsyncOpenAI  # type: ignore

    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    kwargs: dict[str, Any] = dict(
        model=model,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )

    if response_schema:
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {
                "name": response_schema.get("title", "response"),
                "strict": True,
                "schema": response_schema,
            },
        }
    else:
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# Anthropic client
# ---------------------------------------------------------------------------

async def _call_anthropic(
    system_prompt: str,
    user_message: str,
    model: str = ANTHROPIC_MODEL,
    temperature: float = 0.2,
) -> str:
    import anthropic  # type: ignore

    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Use cache_control for the system prompt (prompt caching)
    response = await client.messages.create(
        model=model,
        max_tokens=4096,
        temperature=temperature,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text  # type: ignore[index]


# ---------------------------------------------------------------------------
# Ollama (local) client
# ---------------------------------------------------------------------------

async def _call_ollama(
    system_prompt: str,
    user_message: str,
    model: str = OLLAMA_MODEL,
    temperature: float = 0.2,
) -> str:
    from openai import AsyncOpenAI  # type: ignore

    # Ollama exposes an OpenAI-compatible endpoint
    client = AsyncOpenAI(base_url=OLLAMA_BASE_URL, api_key="ollama")
    response = await client.chat.completions.create(
        model=model,
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def llm_json_call(
    system_prompt: str,
    user_message: str,
    response_model: Type[T],
    temperature: float = 0.2,
) -> T:
    """
    Make an async LLM call and parse the JSON response into `response_model`.

    Args:
        system_prompt: The system prompt (cached in Anthropic mode).
        user_message:  The per-request user message.
        response_model: A Pydantic BaseModel class to parse the response into.
        temperature:   Sampling temperature (default 0.2 for consistent evals).

    Returns:
        An instance of `response_model`.

    Raises:
        ValueError: If the LLM returns unparse-able JSON after all retries.
    """
    provider = get_llm_provider()

    async def _do_call() -> str:
        if provider == "gemini":
            return await _call_gemini(
                system_prompt,
                user_message,
                response_schema=response_model,
                temperature=temperature,
            )
        elif provider == "anthropic":
            return await _call_anthropic(system_prompt, user_message, temperature=temperature)
        elif provider == "ollama":
            return await _call_ollama(system_prompt, user_message, temperature=temperature)
        else:
            schema = response_model.model_json_schema()
            return await _call_openai(
                system_prompt,
                user_message,
                response_schema=schema,
                temperature=temperature,
            )

    raw = await _with_retry(_do_call)
    data = _extract_json(raw)
    return response_model.model_validate(data)


async def llm_text_call(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.3,
) -> str:
    """Plain-text (non-JSON) LLM call with retry."""
    provider = get_llm_provider()

    async def _do_call() -> str:
        if provider == "gemini":
            return await _call_gemini(system_prompt, user_message, temperature=temperature)
        elif provider == "anthropic":
            return await _call_anthropic(system_prompt, user_message, temperature=temperature)
        elif provider == "ollama":
            return await _call_ollama(system_prompt, user_message, temperature=temperature)
        else:
            from openai import AsyncOpenAI  # type: ignore
            client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
            response = await client.chat.completions.create(
                model=get_openai_model(),
                temperature=temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )
            return response.choices[0].message.content or ""

    return await _with_retry(_do_call)

