"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Quote, AlertTriangle, Lightbulb } from "lucide-react";
import { CriterionEvaluation, EvidenceQuote } from "@/lib/types";

interface CriterionCardProps {
  criterion: CriterionEvaluation;
  index: number;
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

export default function CriterionCard({ criterion, index }: CriterionCardProps) {
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
        className="w-full p-4 text-left flex flex-col gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        {/* Top row: Title + Actions */}
        <div className="flex items-start justify-between w-full gap-4">
          {/* Left side: Index + Title */}
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 mt-0.5"
              style={{ color: criterion.is_advisory ? "var(--text-muted)" : scoreColor }}
            >
              {index + 1}
            </div>
            <h3 className="text-sm font-bold font-display leading-snug">
              {criterion.criterion_title}
            </h3>
          </div>

          {/* Right side: Badges + Score + Chevron */}
          <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0 mt-1">
            {criterion.is_advisory && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                ADVISORY (UNGRADED)
              </span>
            )}
            {criterion.was_arbitrated && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                RECONCILED
              </span>
            )}
            {!criterion.is_advisory && (
              <>
                <span className="font-bold text-sm" style={{ color: scoreColor }}>
                  {criterion.assigned_score.toFixed(1)}/{criterion.max_score}
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800"
                  style={{ color: scoreColor }}
                >
                  {pct.toFixed(0)}%
                </span>
              </>
            )}
            <div className="text-zinc-400 ml-1">
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
        </div>

        {/* Score bar */}
        {!criterion.is_advisory && (
          <div className="w-full pl-11 pr-2">
            <div className="score-bar-track">
              <div
                className="score-bar-fill"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
          </div>
        )}

        {/* Jury scores mini-row */}
        {criterion.jury_scores && Object.keys(criterion.jury_scores).length > 0 && (
          <div className="w-full pl-11 flex flex-wrap gap-2">
            {Object.entries(criterion.jury_scores).map(([agent, score]) => (
              <div key={agent} className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100/50 dark:bg-zinc-800/30 border border-zinc-200/50 dark:border-zinc-700/50">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{agent.replace("Agent ", "")}</span>
                <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  {score.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </button>

      {/* Expanded content */}
      <div className={`border-t border-zinc-200 dark:border-zinc-800 px-4 pb-4 pt-3 bg-zinc-50/50 dark:bg-zinc-900/20 ${isExpanded ? "block" : "hidden print:block"}`}>
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
              </p>
              <div className="space-y-2">
                {criterion.evidence.map((quoteObj: EvidenceQuote, qi: number) => {
                  return (
                    <div
                      key={qi}
                      className="w-full text-left p-3 rounded-lg border text-sm leading-relaxed italic bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                    >
                      "{quoteObj.quote_text}"
                      {quoteObj.confidence_score < 1.0 && quoteObj.confidence_score > 0 && (
                         <span className="text-[10px] text-zinc-400 ml-2">(fuzzy match)</span>
                      )}
                    </div>
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
    </div>
  );
}
