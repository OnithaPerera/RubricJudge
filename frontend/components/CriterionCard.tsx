"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Quote, AlertTriangle, Lightbulb } from "lucide-react";
import { CriterionEvaluation, EvidenceQuote } from "@/lib/types";

interface CriterionCardProps {
  criterion: CriterionEvaluation;
  index: number;
  onQuoteClick: (quote: EvidenceQuote) => void;
  isQuoteActive: (quote: EvidenceQuote) => boolean;
}

function getScoreColor(pct: number): string {
  if (pct >= 85) return "var(--color-success)";
  if (pct >= 70) return "var(--color-warning)";
  if (pct >= 55) return "hsl(28, 90%, 60%)";
  return "var(--color-error)";
}

function getBarColor(pct: number): string {
  if (pct >= 85) return "var(--color-success)";
  if (pct >= 70) return "var(--color-warning)";
  if (pct >= 55) return "hsl(28, 90%, 60%)";
  return "var(--color-error)";
}

export default function CriterionCard({ criterion, index, onQuoteClick, isQuoteActive }: CriterionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const pct = criterion.percentage;
  const scoreColor = getScoreColor(pct);
  const barColor = getBarColor(pct);

  return (
    <div
      className="glass-card overflow-hidden slide-up"
      style={{ animationDelay: `${index * 0.06}s`, opacity: 0 }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        {/* Index bubble */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-zinc-100 dark:bg-zinc-800"
          style={{ color: scoreColor }}
        >
          {index + 1}
        </div>

        {/* Title + bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-bold truncate pr-3 font-display">
              {criterion.criterion_title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {criterion.was_arbitrated && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  RECONCILED
                </span>
              )}
              <span className="font-bold text-sm" style={{ color: scoreColor }}>
                {criterion.assigned_score.toFixed(1)}/{criterion.max_score}
              </span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800"
                style={{ color: scoreColor }}
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
          {criterion.jury_scores && Object.entries(criterion.jury_scores).map(([agent, score]) => (
            <div key={agent} className="text-center">
              <div className="text-[10px] text-zinc-500">{agent.replace("Agent ", "")}</div>
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {score.toFixed(1)}
              </div>
            </div>
          ))}
        </div>

        {/* Expand toggle */}
        <div className="text-zinc-400 flex-shrink-0">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 pb-4 pt-3 bg-zinc-50/50 dark:bg-zinc-900/20">
          {/* Confidence badge */}
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={13} className="text-zinc-400" />
            <span className="text-xs text-zinc-500">
              Confidence: {(criterion.confidence * 100).toFixed(0)}%
            </span>
            {criterion.arbitration_notes && (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                <AlertTriangle size={12} className="inline mr-1" />
                {criterion.arbitration_notes}
              </span>
            )}
          </div>

          {/* Critique */}
          {criterion.critique && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider text-zinc-500">
                Critique
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {criterion.critique}
              </p>
            </div>
          )}

          {/* Evidence quotes */}
          {criterion.evidence?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider flex items-center gap-1 text-zinc-500">
                <Quote size={11} />
                Evidence Quotes
                <span className="text-[10px] font-normal normal-case opacity-80">
                  (click to locate in draft)
                </span>
              </p>
              <div className="space-y-2">
                {criterion.evidence.map((quoteObj: EvidenceQuote, qi: number) => {
                  const isActive = isQuoteActive(quoteObj);
                  return (
                    <button
                      key={qi}
                      type="button"
                      onClick={() => onQuoteClick(quoteObj)}
                      className={`w-full text-left p-3 rounded-lg transition-all border text-sm leading-relaxed italic
                        ${isActive 
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-100" 
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }
                      `}
                    >
                      "{quoteObj.quote_text}"
                      {quoteObj.confidence_score < 1.0 && quoteObj.confidence_score > 0 && (
                         <span className="text-[10px] text-zinc-400 ml-2">(fuzzy match)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revision prompts */}
          {criterion.actionable_questions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider flex items-center gap-1 text-zinc-500">
                <Lightbulb size={11} />
                Guiding Questions for Revision
              </p>
              <ul className="space-y-2">
                {criterion.actionable_questions.map((prompt, pi) => (
                  <li
                    key={pi}
                    className="flex gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5">›</span>
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
