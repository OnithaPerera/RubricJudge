# RubricJudge 🎓

> **AI-powered multi-agent assignment evaluation platform.**
> 
> A committee of specialist AI judges evaluates your assignment draft against a rubric, reconciles disagreements, and delivers a diagnostic report with scores, evidence, and guided revision questions.

---

## Architecture Overview

```
[Student Draft + Rubric]
        │
        ▼
[Agent 0: Rubric Parser & Normalizer]   <- Heuristic + LLM fallback
        │
        ▼
[Deterministic Pre-Processor]           <- Word count, citations, headers (no LLM)
        │
        ▼
[Parallel Specialist Judges - asyncio.gather()]
  ├── Agent A: Rubric Alignment Judge   <- G-Eval 5-step CoT
  ├── Agent B: Critical Reasoning Judge <- Depth, logic, and assumptions
  └── Agent C: Style & Citations Auditor<- Clarity, structure, references
        │
        ▼
[Agent D: Consensus Engine]
  ├── Category-weighted score merge
  ├── Reconciliation pass if variance > 15% on any criterion
  └── Python-deterministic quote offset verification
        │
        ▼
[Final Report Generation]               <- Anti-ghostwriting filtered
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic v2, `aiosqlite` |
| LLM Orchestration | Google Gemini (default, multi-key round-robin), OpenAI GPT-4o, Anthropic Claude, Ollama (local) |
| Job Storage | SQLite via `aiosqlite` (persistent, async TTL cleanup, in-memory SSE queue) |
| Document Parsing | `pdfplumber`, `pypdf`, `python-docx` |
| Streaming | Server-Sent Events (SSE) via FastAPI `StreamingResponse` |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| Charts | Recharts (`RadarChart`) |
| Icons | `lucide-react` |

---

## Quickstart

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Google Gemini API key (free at [Google AI Studio](https://aistudio.google.com/apikey)), or OpenAI / Anthropic / local Ollama

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and add your GEMINI_API_KEY (or OpenAI/Anthropic keys)

# Run the API server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
API docs (Swagger UI): `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend

npm install

# Run development server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## API Reference

### `POST /api/evaluate`
Start an evaluation. Accepts `multipart/form-data`:

| Field | Type | Required | Description |
|---|---|---|---|
| `draft_text` | string | Optional* | Raw assignment text |
| `rubric_text` | string | Optional* | Raw rubric text |
| `draft_file` | file | Optional* | PDF/DOCX/TXT upload |
| `rubric_file` | file | Optional* | PDF/DOCX/TXT upload |
| `assignment_title` | string | Optional | Optional assignment title |

*One of `_text` or `_file` is required for each of draft and rubric.

**Response:**
```json
{
  "job_id": "uuid",
  "message": "Evaluation started.",
  "stream_url": "/api/evaluate/stream/{job_id}"
}
```

### `GET /api/evaluate/stream/{job_id}`
SSE stream. Events are JSON objects:

```json
// Progress events
{"stage": "running_specialist_judges", "progress_percentage": 55, "active_agent": "Agent A", "message": "..."}

// Final event
{"stage": "completed", "progress_percentage": 100, "result": { ...FinalConsensusReport... }}
```

### `GET /api/jobs/{job_id}/status`
Polling fallback. Returns current job status and final result if complete.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini` \| `openai` \| `anthropic` \| `ollama` |
| `GEMINI_API_KEY` | None | Gemini API Key(s). Supports comma-separated keys for auto round-robin rotation |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model ID (e.g. `gemini-2.0-flash`, `gemini-2.5-flash`) |
| `OPENAI_API_KEY` | None | Required for OpenAI provider |
| `OPENAI_MODEL` | `gpt-4o` | Model ID for OpenAI |
| `ANTHROPIC_API_KEY` | None | Required for Anthropic provider |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-20241022` | Model ID for Anthropic |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama endpoint |
| `OLLAMA_MODEL` | `llama3` | Local model name |
| `LLM_MAX_RETRIES` | `3` | Retry attempts per LLM call |
| `LLM_BASE_BACKOFF` | `2.0` | Exponential backoff base (seconds) with 429 Retry-After support |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allowed origin |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |

---

## Agent Weighting Matrix

Criterion scores are merged using category-specific weights to give each specialist agent appropriate authority:

| Criterion Type | Agent A (Rubric) | Agent B (Depth) | Agent C (Style) |
|---|---|---|---|
| Content & Argumentation | 30% | **60%** | 10% |
| Structure & Formatting | 30% | 10% | **60%** |
| Task Fulfillment / Scope | **70%** | 20% | 10% |
| Other | 40% | 30% | 30% |

### Reconciliation Trigger

If the variance between judges on a single criterion exceeds **15%** of its max score:

```
Delta_crit = max(S_A, S_B, S_C) - min(S_A, S_B, S_C)
Trigger arbitration if: Delta_crit / MaxScore_crit > 0.15
```

Agent D sends a targeted arbitration prompt with the conflicting scorecards and delivers an authoritative reconciled score.

### Deterministic Evidence Grounding

Instead of relying on inaccurate LLM character offset calculations:
- Judges extract verbatim text snippets (`quote_text`).
- Python post-processing locates exact `char_start` and `char_end` coordinates using substring matching with whitespace-normalization fallback.
- Offsets are verified deterministically before inclusion in the final consensus scorecard.

---

## Safety & Guardrails

- **Prompt Injection Protection:** All user inputs (rubric and draft) are enclosed in XML tags (`<rubric_input>`, `<student_submission>`). System prompts explicitly instruct agents to treat enclosed text as untrusted data.
- **Anti-Ghostwriting Filter:** Suggestions containing direct text replacement patterns (e.g., *"Replace your paragraph with:"*) are automatically stripped before the report is returned.
- **Diagnostic Disclaimer:** All reports include a prominent disclaimer that scores are AI-generated estimates and do not constitute official academic assessment.

---

## Project Structure

```
RubricJudge/
├── backend/
│   ├── main.py                    # FastAPI app + SSE endpoints + DB lifespan
│   ├── models.py                  # Pydantic v2 data contracts
│   ├── requirements.txt           # Python dependencies (fastapi, aiosqlite, etc.)
│   ├── .env.example
│   ├── services/
│   │   ├── llm_client.py          # Multi-key round-robin rotation & retry backoff
│   │   ├── rubric_parser.py       # Agent 0: Rubric normalisation
│   │   ├── preprocessor.py        # Deterministic document pre-processor
│   │   └── evaluators.py          # Agents A, B, C, D + quote verification
│   └── utils/
│       ├── document_loader.py     # PDF/DOCX text extraction
│       └── job_store.py           # aiosqlite persistent job store + SSE queue
└── frontend/
    ├── app/
    │   ├── layout.tsx             # Root layout
    │   ├── page.tsx               # State machine orchestrator
    │   └── globals.css            # Academic design tokens and styles
    ├── components/
    │   ├── InputPanel.tsx         # Two-column input + file upload
    │   ├── AgentStatusTracker.tsx # Real-time SSE progress UI
    │   ├── ResultsDashboard.tsx   # Score summary, criteria breakdown, export
    │   ├── CriterionCard.tsx      # Evidence quotes, jury scores, questions
    │   ├── RadarChart.tsx         # Recharts radar chart
    │   └── RevisionChecklist.tsx  # Prioritized actionable revisions
    ├── lib/
    │   └── types.ts               # Shared TypeScript data contracts
    └── .env.local
```

---

## License

MIT - built for educational diagnostic use only.
