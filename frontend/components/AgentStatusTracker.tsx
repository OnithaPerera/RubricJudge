"use client";

import { useEffect, useRef } from "react";
import { CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { AgentStatus, StreamProgressEvent, PipelineStage } from "@/lib/types";

interface AgentStatusTrackerProps {
  events: StreamProgressEvent[];
  agentStatuses: AgentStatus[];
  currentProgress: number;
  currentStage: PipelineStage | null;
}

const PIPELINE_PHASES = [
  {
    stage: "parsing_rubric",
    label: "Rubric Parser",
    sublabel: "Agent 0: Normalising criteria",
    color: "var(--accent-a)",
    bg: "hsla(186,85%,56%,0.12)",
  },
  {
    stage: "preflight_checks",
    label: "Pre-flight Checks",
    sublabel: "Deterministic metrics analysis",
    color: "var(--accent-b)",
    bg: "hsla(38,92%,60%,0.12)",
  },
  {
    stage: "running_specialist_judges",
    label: "Specialist Judges",
    sublabel: "Agent A · B · C running in parallel",
    color: "var(--color-brand-400)",
    bg: "hsla(245,91%,72%,0.12)",
  },
  {
    stage: "arbitrating_discrepancies",
    label: "Consensus Engine",
    sublabel: "Agent D: Reconciling variances",
    color: "var(--accent-c)",
    bg: "hsla(280,80%,68%,0.12)",
  },
  {
    stage: "generating_final_report",
    label: "Final Report",
    sublabel: "Synthesising evaluation output",
    color: "var(--accent-d)",
    bg: "hsla(142,70%,55%,0.12)",
  },
];

function stageOrder(stage: PipelineStage): number {
  const order: Record<string, number> = {
    parsing_rubric: 0,
    preflight_checks: 1,
    running_specialist_judges: 2,
    arbitrating_discrepancies: 3,
    generating_final_report: 4,
    completed: 5,
    failed: 5,
  };
  return order[stage] ?? -1;
}

export default function AgentStatusTracker({
  events,
  agentStatuses,
  currentProgress,
  currentStage,
}: AgentStatusTrackerProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const currentOrderIdx = currentStage ? stageOrder(currentStage) : -1;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8 slide-up">
        <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Evaluation in Progress
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
          Your assignment is being reviewed by the multi-agent committee
        </p>
      </div>

      {/* Master progress bar */}
      <div className="glass-card p-5 mb-6 slide-up">
        <div className="flex justify-between items-center mb-3">
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
            Overall Progress
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-brand-400)" }}>
            {currentProgress}%
          </span>
        </div>
        <div className="score-bar-track">
          <div
            className="score-bar-fill"
            style={{
              width: `${currentProgress}%`,
              background: "linear-gradient(90deg, var(--color-brand-600), var(--color-brand-400))",
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>
      </div>

      {/* Phase cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {PIPELINE_PHASES.map((phase, idx) => {
          const isDone = currentOrderIdx > idx;
          const isActive = currentOrderIdx === idx;
          const isFailed = currentStage === "failed" && isActive;

          return (
            <div
              key={phase.stage}
              className="glass-card p-4 slide-up"
              style={{
                animationDelay: `${idx * 0.07}s`,
                opacity: 0,
                border: isActive
                  ? `1px solid ${phase.color}44`
                  : "1px solid var(--glass-border)",
                background: isActive ? phase.bg : undefined,
              }}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0`}
                  style={{
                    background: isDone
                      ? "hsla(142,70%,48%,0.2)"
                      : isFailed
                      ? "hsla(0,75%,58%,0.2)"
                      : isActive
                      ? `${phase.color}22`
                      : "var(--surface-3)",
                  }}
                >
                  {isDone ? (
                    <CheckCircle size={18} style={{ color: "var(--color-success)" }} />
                  ) : isFailed ? (
                    <XCircle size={18} style={{ color: "var(--color-error)" }} />
                  ) : isActive ? (
                    <Loader2 size={18} style={{ color: phase.color }} className="animate-spin" />
                  ) : (
                    <Clock size={18} style={{ color: "var(--text-muted)" }} />
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{
                      color: isDone
                        ? "var(--color-success)"
                        : isActive
                        ? phase.color
                        : "var(--text-muted)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {phase.label}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {phase.sublabel}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live event log */}
      <div className="glass-card p-4">
        <p
          className="text-xs font-semibold mb-3 flex items-center gap-2"
          style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background:
                currentStage === "completed"
                  ? "var(--color-success)"
                  : currentStage === "failed"
                  ? "var(--color-error)"
                  : "var(--color-brand-400)",
              boxShadow: currentStage && !["completed", "failed"].includes(currentStage)
                ? "0 0 6px var(--color-brand-400)"
                : "none",
              animation: "none",
            }}
          />
          LIVE EVALUATION LOG
        </p>
        <div
          ref={logRef}
          className="overflow-y-auto space-y-1"
          style={{ maxHeight: 220 }}
        >
          {events.map((evt, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-1 rounded"
              style={{
                fontSize: 12,
                color: evt.stage === "failed" ? "var(--color-error)" : "var(--text-secondary)",
              }}
            >
              <span style={{ color: "var(--text-muted)", flexShrink: 0, fontFamily: "monospace" }}>
                {new Date(evt.timestamp).toLocaleTimeString()}
              </span>
              {evt.active_agent && (
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-bold flex-shrink-0"
                  style={{
                    background: "hsla(248,87%,61%,0.2)",
                    color: "var(--color-brand-400)",
                    fontSize: 10,
                  }}
                >
                  {evt.active_agent}
                </span>
              )}
              <span className="flex-1">{evt.message}</span>
            </div>
          ))}
          {events.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
              Waiting for first event…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
