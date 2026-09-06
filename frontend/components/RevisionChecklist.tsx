"use client";

import { useState } from "react";
import { CheckSquare, Square, HelpCircle, TrendingUp } from "lucide-react";
import { FinalConsensusReport } from "@/lib/types";

interface RevisionChecklistProps {
  report: FinalConsensusReport;
}

export default function RevisionChecklist({ report }: RevisionChecklistProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Sort criteria by impact (lowest score = highest priority)
  const sortedCriteria = [...report.criteria_breakdown].sort(
    (a, b) => a.percentage - b.percentage
  );

  const completedCount = checked.size;
  const totalCount = report.priority_revisions.length;
  const completionPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress summary */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} style={{ color: "var(--accent-d)" }} />
            <span className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Revision Progress
            </span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-d)" }}>
            {completedCount}/{totalCount} done
          </span>
        </div>
        <div className="score-bar-track">
          <div
            className="score-bar-fill"
            style={{
              width: `${completionPct}%`,
              background: "linear-gradient(90deg, hsl(142,70%,35%), hsl(142,70%,55%))",
            }}
          />
        </div>
      </div>

      {/* Priority improvements */}
      {report.priority_revisions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} style={{ color: "var(--color-brand-400)" }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Priority Improvements
            </h3>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              (highest score impact first)
            </span>
          </div>
          <div className="space-y-2">
            {report.priority_revisions.map((improvement, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all"
                style={{
                  background: checked.has(i) ? "hsla(142,70%,48%,0.1)" : "var(--surface-2)",
                  border: `1px solid ${checked.has(i) ? "hsla(142,70%,48%,0.3)" : "transparent"}`,
                }}
              >
                {checked.has(i) ? (
                  <CheckSquare size={16} style={{ color: "var(--color-success)", marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <Square size={16} style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: 13,
                    color: checked.has(i) ? "var(--text-muted)" : "var(--text-secondary)",
                    textDecoration: checked.has(i) ? "line-through" : "none",
                    lineHeight: 1.6,
                  }}
                >
                  {improvement}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Impact breakdown by criterion */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={15} style={{ color: "var(--accent-b)" }} />
          <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Criterion Impact Map
          </h3>
        </div>
        <div className="space-y-2">
          {sortedCriteria.map((c, i) => {
            const gap = c.max_score - c.assigned_score;
            return (
              <div
                key={c.criterion_id}
                className="p-3 rounded-xl"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {c.criterion_title}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: gap > 5 ? "var(--color-warning)" : "var(--color-success)"
                  }}>
                    {gap > 0 ? `+${gap.toFixed(1)} pts potential` : "✓ Strong"}
                  </span>
                </div>
                <div className="score-bar-track" style={{ height: 5 }}>
                  <div
                    className="score-bar-fill"
                    style={{
                      width: `${c.percentage}%`,
                      background: c.percentage >= 75
                        ? "linear-gradient(90deg, hsl(142,70%,35%), hsl(142,70%,55%))"
                        : "linear-gradient(90deg, hsl(38,92%,40%), hsl(38,92%,60%))",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Guiding questions */}
      {report.guiding_questions_for_revision.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle size={15} style={{ color: "var(--accent-c)" }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Reflection Questions
            </h3>
          </div>
          <div className="space-y-2">
            {report.guiding_questions_for_revision.map((q, i) => (
              <div
                key={i}
                className="p-3 rounded-xl flex gap-3"
                style={{ background: "hsla(280,80%,68%,0.08)", border: "1px solid hsla(280,80%,68%,0.15)" }}
              >
                <span style={{ color: "var(--accent-c)", fontWeight: 700, flexShrink: 0 }}>
                  Q{i + 1}.
                </span>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  {q}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
