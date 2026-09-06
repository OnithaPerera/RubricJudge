"use client";

import { useState } from "react";
import { CheckSquare, Square, HelpCircle, TrendingUp, Copy, Check } from "lucide-react";
import { FinalConsensusReport } from "@/lib/types";

interface RevisionChecklistProps {
  report: FinalConsensusReport;
}

export default function RevisionChecklist({ report }: RevisionChecklistProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const copyToClipboard = async () => {
    const lines = [
      `# Revision Plan for: ${report.letter_grade} (${report.overall_percentage.toFixed(1)}%)`,
      ``,
      `## Priority Improvements`,
      ...report.priority_revisions.map((rev, i) => `- [${checked.has(i) ? "x" : " "}] ${rev}`),
      ``,
      `## Reflection Questions`,
      ...report.guiding_questions_for_revision.map((q, i) => `**Q${i + 1}.** ${q}`),
    ];
    
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const sortedCriteria = [...report.criteria_breakdown].sort(
    (a, b) => a.percentage - b.percentage
  );

  const completedCount = checked.size;
  const totalCount = report.priority_revisions.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress summary and actions */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckSquare size={16} className="text-zinc-600 dark:text-zinc-400" />
              <span className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100">
                Revision Progress
              </span>
            </div>
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              {completedCount}/{totalCount} done
            </span>
          </div>
          <div className="score-bar-track bg-zinc-200 dark:bg-zinc-800">
            <div
              className="score-bar-fill bg-zinc-800 dark:bg-zinc-200"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
        
        <button
          onClick={copyToClipboard}
          className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-sm font-semibold transition-colors text-zinc-900 dark:text-zinc-100"
        >
          {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          {copied ? "Copied!" : "Copy Plan (.md)"}
        </button>
      </div>

      {/* Priority improvements */}
      {report.priority_revisions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-amber-500" />
            <h3 className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100">
              Priority Improvements
            </h3>
            <span className="text-[11px] text-zinc-500">
              (highest score impact first)
            </span>
          </div>
          <div className="space-y-2">
            {report.priority_revisions.map((improvement, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all border
                  ${checked.has(i) 
                    ? "bg-zinc-100 dark:bg-zinc-900/50 border-transparent opacity-60" 
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
              >
                {checked.has(i) ? (
                  <CheckSquare size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Square size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                )}
                <span
                  className={`text-sm leading-relaxed ${
                    checked.has(i) ? "text-zinc-500 line-through" : "text-zinc-700 dark:text-zinc-300"
                  }`}
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
          <TrendingUp size={15} className="text-emerald-500" />
          <h3 className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100">
            Criterion Impact Map
          </h3>
        </div>
        <div className="space-y-2">
          {sortedCriteria.map((c, i) => {
            const gap = c.max_score - c.assigned_score;
            return (
              <div
                key={c.criterion_id}
                className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {c.criterion_title}
                  </span>
                  <span className={`text-xs font-bold ${gap > 5 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {gap > 0 ? `+${gap.toFixed(1)} pts potential` : "✓ Strong"}
                  </span>
                </div>
                <div className="score-bar-track h-1.5 bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`score-bar-fill ${c.percentage >= 75 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${c.percentage}%` }}
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
            <HelpCircle size={15} className="text-zinc-500" />
            <h3 className="text-sm font-bold font-display text-zinc-900 dark:text-zinc-100">
              Reflection Questions
            </h3>
          </div>
          <div className="space-y-2">
            {report.guiding_questions_for_revision.map((q, i) => (
              <div
                key={i}
                className="p-3 rounded-xl flex gap-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800/50"
              >
                <span className="text-zinc-400 font-bold flex-shrink-0">
                  Q{i + 1}.
                </span>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
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
