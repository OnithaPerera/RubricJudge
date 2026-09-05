"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import InputPanel from "@/components/InputPanel";
import AgentStatusTracker from "@/components/AgentStatusTracker";
import ResultsDashboard from "@/components/ResultsDashboard";
import {
  FinalConsensusReport,
  StreamProgressEvent,
  AgentStatus,
  PipelineStage,
  EvaluationJobResponse,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AppState = "idle" | "submitting" | "evaluating" | "complete" | "error";

const INITIAL_AGENT_STATUSES: AgentStatus[] = [
  { name: "agent-0", label: "Rubric Parser", status: "idle" },
  { name: "agent-a", label: "Rubric Alignment Judge", status: "idle" },
  { name: "agent-b", label: "Critical Reasoning Judge", status: "idle" },
  { name: "agent-c", label: "Style & Citations Auditor", status: "idle" },
  { name: "agent-d", label: "Consensus Engine", status: "idle" },
];

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [events, setEvents] = useState<StreamProgressEvent[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>(INITIAL_AGENT_STATUSES);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<PipelineStage | null>(null);
  const [report, setReport] = useState<FinalConsensusReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<string>("");

  const esRef = useRef<EventSource | null>(null);

  const cleanup = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  };

  useEffect(() => () => cleanup(), []);

  const handleSubmit = useCallback(
    async (
      draft: string,
      rubric: string,
      title: string,
      draftFile?: File | null,
      rubricFile?: File | null
    ) => {
      cleanup();
      setAppState("submitting");
      setEvents([]);
      setAgentStatuses(INITIAL_AGENT_STATUSES);
      setCurrentProgress(0);
      setCurrentStage(null);
      setReport(null);
      setErrorMessage(null);
      setDraftText(draft || (draftFile ? `[Uploaded file: ${draftFile.name}]` : ""));

      try {
        // 1. POST to create the evaluation job
        const formData = new FormData();
        if (draft) formData.append("draft_text", draft);
        if (rubric) formData.append("rubric_text", rubric);
        if (title) formData.append("assignment_title", title);
        if (draftFile) formData.append("draft_file", draftFile);
        if (rubricFile) formData.append("rubric_file", rubricFile);

        const res = await fetch(`${API_BASE}/api/evaluate`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(errData.detail || `HTTP ${res.status}`);
        }

        const jobData: EvaluationJobResponse = await res.json();
        setAppState("evaluating");

        // 2. Open SSE stream
        const es = new EventSource(`${API_BASE}${jobData.stream_url}`);
        esRef.current = es;

        es.onmessage = (e) => {
          const event: StreamProgressEvent = JSON.parse(e.data);
          setEvents((prev) => [...prev, event]);
          setCurrentProgress(event.progress_percentage);
          setCurrentStage(event.stage);

          // Update agent statuses
          if (event.active_agent) {
            setAgentStatuses((prev) =>
              prev.map((a) =>
                a.label.includes(event.active_agent!)
                  ? { ...a, status: "running", message: event.message }
                  : a
              )
            );
          }

          if (event.stage === "completed" && event.result) {
            setReport(event.result);
            setAppState("complete");
            es.close();
            esRef.current = null;
          } else if (event.stage === "failed") {
            setErrorMessage(event.error || "Unknown evaluation error.");
            setAppState("error");
            es.close();
            esRef.current = null;
          }
        };

        es.onerror = () => {
          if (appState !== "complete") {
            setErrorMessage("Connection to evaluation server lost. Please retry.");
            setAppState("error");
          }
          es.close();
          esRef.current = null;
        };
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setAppState("error");
      }
    },
    [appState]
  );

  const handleReset = () => {
    cleanup();
    setAppState("idle");
    setEvents([]);
    setAgentStatuses(INITIAL_AGENT_STATUSES);
    setCurrentProgress(0);
    setCurrentStage(null);
    setReport(null);
    setErrorMessage(null);
    setDraftText("");
  };

  return (
    <>
      {/* Animated mesh background */}
      <div className="bg-mesh" aria-hidden="true" />

      <main className="relative z-10 min-h-screen">
        {/* Error Banner */}
        {appState === "error" && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-card px-5 py-3 flex items-center gap-3"
            style={{ border: "1px solid hsla(0,75%,58%,0.4)", maxWidth: 500 }}
            role="alert"
          >
            <span style={{ color: "var(--color-error)", fontSize: 13 }}>
              ⚠️ {errorMessage}
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="btn-ghost"
              style={{ fontSize: 12 }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* State machine */}
        {appState === "idle" || appState === "submitting" || appState === "error" ? (
          <InputPanel
            onSubmit={handleSubmit}
            isLoading={appState === "submitting"}
          />
        ) : appState === "evaluating" ? (
          <AgentStatusTracker
            events={events}
            agentStatuses={agentStatuses}
            currentProgress={currentProgress}
            currentStage={currentStage}
          />
        ) : appState === "complete" && report ? (
          <ResultsDashboard report={report} onReset={handleReset} draftText={draftText} />
        ) : null}
      </main>
    </>
  );
}
