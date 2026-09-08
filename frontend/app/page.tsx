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
import { Users, Target, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

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
      settings: import("@/lib/types").EvaluationSettings,
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
        formData.append("settings", JSON.stringify(settings));
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
          <div className="pb-24">
            <InputPanel
              onSubmit={handleSubmit}
              isLoading={appState === "submitting"}
            />
            
            {appState === "idle" && (
              <>
                {/* How It Works Section */}
                <section id="how-it-works" className="max-w-6xl mx-auto px-4 py-16">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold mb-4 font-display text-foreground">How It Works</h2>
                    <p className="text-zinc-500 max-w-2xl mx-auto">
                      A simple, transparent process to align your work with expectations.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Step 1 */}
                    <div className="glass-card p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
                        <Target size={24} />
                      </div>
                      <h3 className="text-lg font-bold mb-2">1. Drop Your Files</h3>
                      <p className="text-sm text-zinc-500">
                        Upload your assignment prompt (rubric) and your current draft. We support Canvas, Moodle, and Blackboard compatible .docx and .pdf files.
                      </p>
                    </div>

                    {/* Step 2 */}
                    <div className="glass-card p-6 flex flex-col items-center text-center relative">
                      <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 text-indigo-600 dark:text-indigo-400">
                        <Users size={24} />
                      </div>
                      <h3 className="text-lg font-bold mb-2">2. Multi-Agent Consensus</h3>
                      <p className="text-sm text-zinc-500">
                        Three specialized AI evaluators audit your work for rubric compliance, critical depth, and citation accuracy. They debate discrepancies to reach a consensus.
                      </p>
                    </div>

                    {/* Step 3 */}
                    <div className="glass-card p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={24} />
                      </div>
                      <h3 className="text-lg font-bold mb-2">3. Prioritized Revision</h3>
                      <p className="text-sm text-zinc-500">
                        Receive a calibrated score prediction, exact evidence citations, and a prioritized checklist of high-impact questions to guide your final revision.
                      </p>
                    </div>
                  </div>
                </section>

                {/* FAQ Section */}
                <section className="max-w-3xl mx-auto px-4 py-16">
                  <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-4 font-display text-foreground">Frequently Asked Questions</h2>
                  </div>
                  <div className="space-y-4">
                    <FaqItem 
                      question="Will my professor know I used this?" 
                      answer="No. RubricJudge does not report to universities or save your papers to a database. It is a diagnostic tool, much like a grammar checker, designed to give you feedback before you submit." 
                    />
                    <FaqItem 
                      question="Does this write the essay for me?" 
                      answer="Absolutely not. We adhere strictly to academic integrity guidelines. RubricJudge only reads your text and the rubric to tell you where you missed the mark and what questions you should ask yourself to improve." 
                    />
                    <FaqItem 
                      question="How accurate are the predicted grades?" 
                      answer="The grades are estimates based on how explicitly your draft addresses the rubric criteria. The multi-agent consensus system is highly calibrated, but human markers may still have subjective preferences. Always use the score as a guide, not a guarantee." 
                    />
                    <FaqItem 
                      question="What happens to my uploaded files?" 
                      answer="Files are processed in memory for the duration of the evaluation and are immediately discarded. We do not store, retain, or train models on your uploaded documents." 
                    />
                  </div>
                </section>
              </>
            )}
          </div>
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="glass-card rounded-xl overflow-hidden transition-all">
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="font-bold text-foreground">{question}</span>
        {isOpen ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-4 pt-2 border-t border-border bg-zinc-50/50 dark:bg-zinc-900/20 text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
