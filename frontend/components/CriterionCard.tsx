"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Quote, AlertTriangle, Lightbulb } from "lucide-react";
import { CriterionEvaluation, EvidenceQuote } from "@/lib/types";

interface CriterionCardProps {
  criterion: CriterionEvaluation;
  index: number;
  draftText?: string;
}

function getScoreColor(pct: number): string {
  if (pct >= 85) return "var(--color-success)";
  if (pct >= 70) return "var(--accent-b)";
  if (pct >= 55) return "hsl(28, 90%, 60%)";
  return "var(--color-error)";
}

function getBarColor(pct: number): string {
  if (pct >= 85) return "linear-gradient(90deg, hsl(142,70%,35%), hsl(142,70%,55%))";
  if (pct >= 70) return "linear-gradient(90deg, hsl(38,92%,40%), hsl(38,92%,60%))";
  if (pct >= 55) return "linear-gradient(90deg, hsl(28,90%,40%), hsl(28,90%,60%))";
  return "linear-gradient(90deg, hsl(0,75%,38%), hsl(0,75%,58%))";
}

export default function CriterionCard({ criterion, index, draftText }: CriterionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);

  const pct = criterion.percentage;
  const scoreColor = getScoreColor(pct);
  const barColor = getBarColor(pct);

  const highlightDraftText = (quote: string) => {
    setHighlightedQuote(highlightedQuote === quote ? null : quote);
  };

  // Highlight the selected quote in the draft excerpt
  const getDraftPreview = () => {
    if (!draftText || !highlightedQuote) return null;
    const idx = draftText.indexOf(highlightedQuote.slice(0, 40));
    if (idx === -1) return null;
    const start = Math.max(0, idx - 80);
    const end = Math.min(draftText.length, idx + highlightedQuote.length + 80);
    return draftText.slice(start, end);
  };

  const draftPreview = getDraftPreview();

  return (
    <div
      className="glass-card overflow-hidden slide-up"
      style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center gap-4"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        {/* Index bubble */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{ background: `${scoreColor}22`, color: scoreColor }}
        >
          {index + 1}
        </div>

        {/* Title + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-bold truncate pr-3" style={{ fontFamily: "var(--font-display)" }}>
              {criterion.criterion_title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {criterion.was_arbitrated && (
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{ background: "hsla(38,92%,60%,0.2)", color: "var(--accent-b)", fontSize: 10 }}
                >
                  RECONCILED
                </span>
              )}
              <span className="font-bold text-sm" style={{ color: scoreColor }}>
                {criterion.assigned_score.toFixed(1)}/{criterion.max_score}
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${scoreColor}22`, color: scoreColor }}
              >
                {pct.toFixed(0)}%
              </span>
            </div>
          </div>
          {/* Score bar */}
          <div className="score-bar-track">
            <div
              className="score-bar-fill"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
        </div>

        {/* Agent scores mini-row */}
        <div className="hidden md:flex gap-2 flex-shrink-0">
          {Object.entries(criterion.jury_scores).map(([agent, score]) => (
            <div key={agent} className="text-center">
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{agent.replace("Agent ", "")}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                {score.toFixed(1)}
              </div>
            </div>
          ))}
        </div>

        {/* Expand toggle */}
        <div style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--glass-border)" }}>
          {/* Confidence badge */}
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={13} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Confidence: {(criterion.confidence * 100).toFixed(0)}%
            </span>
            {criterion.arbitration_notes && (
              <span style={{ fontSize: 12, color: "var(--accent-b)", marginLeft: 8 }}>
                <AlertTriangle size={12} className="inline mr-1" />
                {criterion.arbitration_notes}
              </span>
            )}
          </div>

          {/* Critique */}
          {criterion.critique && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Critique
              </p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {criterion.critique}
              </p>
            </div>
          )}

          {/* Evidence quotes */}
          {criterion.evidence.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}>
                <Quote size={11} />
                Evidence Quotes
                <span style={{ fontSize: 10, fontWeight: 400, textTransform: "none" }}>
                  (click to locate in draft)
                </span>
              </p>
              <div className="space-y-2">
                {criterion.evidence.map((quoteObj: EvidenceQuote, qi: number) => (
                  <button
                    key={qi}
                    type="button"
                    onClick={() => highlightDraftText(quoteObj.quote_text)}
                    className="w-full text-left p-3 rounded-lg transition-all"
                    style={{
                      background: highlightedQuote === quoteObj.quote_text
                        ? "hsla(248,87%,61%,0.15)"
                        : "var(--surface-2)",
                      border: `1px solid ${highlightedQuote === quoteObj.quote_text ? "var(--color-brand-500)" : "transparent"}`,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      fontStyle: "italic",
                      lineHeight: 1.6,
                    }}
                  >
                    "{quoteObj.quote_text}"
                    {quoteObj.confidence_score < 1.0 && quoteObj.confidence_score > 0 && (
                       <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8 }}>(fuzzy match)</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Draft context highlight */}
              {draftPreview && (
                <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--surface-2)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
                    Draft Context:
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace", lineHeight: 1.7 }}>
                    …{draftPreview.replace(
                      highlightedQuote!.slice(0, 40),
                      `【${highlightedQuote!.slice(0, 40)}】`
                    )}…
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Revision prompts */}
          {criterion.actionable_questions.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}>
                <Lightbulb size={11} />
                Guiding Questions for Revision
              </p>
              <ul className="space-y-2">
                {criterion.actionable_questions.map((prompt, pi) => (
                  <li
                    key={pi}
                    className="flex gap-2 p-2.5 rounded-lg"
                    style={{ background: "hsla(142,70%,48%,0.08)", fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    <span style={{ color: "var(--accent-d)", flexShrink: 0, marginTop: 2 }}>›</span>
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
