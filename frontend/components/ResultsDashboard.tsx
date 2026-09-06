"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart2,
  CheckCircle,
  Star,
  RefreshCcw,
  Download,
  TrendingUp,
  AlertCircle,
  Users,
  FileText,
  X
} from "lucide-react";
import { FinalConsensusReport, EvidenceQuote } from "@/lib/types";
import CriterionCard from "./CriterionCard";
import RadarChart from "./RadarChart";
import RevisionChecklist from "./RevisionChecklist";

interface ResultsDashboardProps {
  report: FinalConsensusReport;
  onReset: () => void;
  draftText?: string;
}

type TabId = "overview" | "criteria" | "revision";

function getGradeStyle(grade: string): { bg: string; color: string } {
  if (grade.startsWith("A")) return { bg: "hsla(142,70%,48%,0.2)", color: "var(--color-success)" };
  if (grade.startsWith("B")) return { bg: "hsla(186,85%,56%,0.2)", color: "var(--accent-a)" };
  if (grade.startsWith("C")) return { bg: "hsla(38,92%,60%,0.2)", color: "var(--accent-b)" };
  return { bg: "hsla(0,75%,58%,0.2)", color: "var(--color-error)" };
}

function StatPill({ label, value, icon: Icon }: {
  label: string; value: string | number; icon: React.ElementType;
}) {
  return (
    <div className="glass-card px-3 py-2 flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
        <Icon size={14} className="text-zinc-600 dark:text-zinc-400" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{label}</p>
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function exportMarkdown(report: FinalConsensusReport): void {
  const lines: string[] = [
    `# RubricJudge Diagnostic Report`,
    ``,
    `> ${report.disclaimer}`,
    ``,
    `## Overall Score`,
    `- **Estimated Score:** ${report.raw_points} / ${report.max_possible_points} (${report.overall_percentage.toFixed(1)}%)`,
    `- **Letter Grade:** ${report.letter_grade}`,
    ``,
    `## Top Strengths`,
    ...report.top_strengths.map((s) => `- ${s}`),
    ``,
    `## Priority Improvements`,
    ...report.priority_revisions.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `## Guiding Questions for Revision`,
    ...report.guiding_questions_for_revision.map((q, i) => `**Q${i + 1}.** ${q}`),
    ``,
    `## Criteria Breakdown`,
  ];

  report.criteria_breakdown.forEach((c) => {
    lines.push(`### ${c.criterion_title} - ${c.assigned_score.toFixed(1)}/${c.max_score} (${c.percentage.toFixed(0)}%)`);
    if (c.critique) lines.push(`**Critique:** ${c.critique}`);
    if (c.actionable_questions?.length) {
      lines.push(`**Revision Prompts:**`);
      c.actionable_questions.forEach((p) => lines.push(`- ${p}`));
    }
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rubricjudge-report.md";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsDashboard({ report, onReset, draftText = "" }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [highlightedQuote, setHighlightedQuote] = useState<EvidenceQuote | null>(null);
  
  const gradeStyle = getGradeStyle(report.letter_grade);
  const stats = report.deterministic_stats;

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (report.overall_percentage / 100) * circumference;

  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedQuote && textRef.current) {
      setTimeout(() => {
        const mark = textRef.current?.querySelector("mark");
        if (mark) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }
  }, [highlightedQuote]);

  const renderDocument = () => {
    if (!draftText) return <p className="text-zinc-500 italic p-4">No document text available.</p>;

    let startIdx = -1;
    let endIdx = -1;
    
    if (highlightedQuote) {
      if (highlightedQuote.char_start >= 0 && highlightedQuote.char_end > highlightedQuote.char_start) {
        startIdx = highlightedQuote.char_start;
        endIdx = highlightedQuote.char_end;
      } else if (highlightedQuote.quote_text) {
        const idx = draftText.toLowerCase().indexOf(highlightedQuote.quote_text.toLowerCase());
        if (idx >= 0) {
          startIdx = idx;
          endIdx = idx + highlightedQuote.quote_text.length;
        }
      }
    }

    const renderLine = (line: string, i: number, lineStart: number, lineEnd: number) => {
      let content: React.ReactNode = line || " ";
      
      if (startIdx >= 0 && endIdx >= 0) {
        if (startIdx < lineEnd && endIdx > lineStart) {
          const highlightStart = Math.max(0, startIdx - lineStart);
          const highlightEnd = Math.min(line.length, endIdx - lineStart);
          const before = line.slice(0, highlightStart);
          const highlighted = line.slice(highlightStart, highlightEnd);
          const after = line.slice(highlightEnd);
          content = (
            <>
              {before}
              <mark className="bg-amber-200 dark:bg-amber-500/40 text-inherit rounded px-0.5">{highlighted}</mark>
              {after}
            </>
          );
        }
      }
      
      return (
        <div key={i} className="flex gap-4 font-mono text-xs md:text-sm mb-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded pr-2 transition-colors">
          <span className="w-8 text-right text-zinc-400 select-none flex-shrink-0">{i + 1}</span>
          <span className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap flex-1 break-words">{content}</span>
        </div>
      );
    };

    let currentIdx = 0;
    return draftText.split("\n").map((line, i) => {
      const lineStart = currentIdx;
      const lineEnd = currentIdx + line.length;
      currentIdx = lineEnd + 1; // +1 for newline character
      return renderLine(line, i, lineStart, lineEnd);
    });
  };

  return (
    <div className="w-full h-[calc(100vh-65px)] flex flex-col md:flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Left Pane: Document View */}
      <div className="w-full md:w-5/12 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-900 print:hidden">
        {/* Sticky Toolbar */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-900 flex items-center justify-between shadow-sm z-10 sticky top-0">
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <FileText size={14} />
              <span>{stats.word_count} words</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <QuoteIcon />
              <span>{stats.citation_density.toFixed(1)} cit/100w</span>
            </div>
          </div>
          {highlightedQuote && (
            <button
              onClick={() => setHighlightedQuote(null)}
              className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
            >
              <X size={12} /> Clear Highlight
            </button>
          )}
        </div>
        {/* Document Body */}
        <div className="flex-1 overflow-y-auto p-4" ref={textRef}>
          {renderDocument()}
        </div>
      </div>

      {/* Right Pane: Report */}
      <div className="w-full md:w-7/12 h-1/2 md:h-full overflow-y-auto p-4 md:p-8 bg-zinc-50 dark:bg-zinc-950/50 print:w-full print:h-auto print:overflow-visible">
        
        {/* Header (hidden in print, handles by globals.css) */}
        <div className="flex items-center justify-between mb-8 print:hidden">
          <div>
            <h2 className="text-2xl font-bold font-display text-zinc-900 dark:text-zinc-100">
              Evaluation Report
            </h2>
            <p className="text-xs text-zinc-500 mt-1">{report.disclaimer}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => exportMarkdown(report)}>
              <Download size={14} />
              Export .md
            </button>
            <button type="button" className="btn-ghost" onClick={onReset}>
              <RefreshCcw size={14} />
              New
            </button>
          </div>
        </div>

        {/* Score hero card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* SVG score ring */}
            <div className="relative flex-shrink-0" style={{ width: 100, height: 100 }}>
              <svg width="100" height="100" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="60" cy="60" r="45" fill="none"
                  stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" strokeWidth="10" />
                <circle cx="60" cy="60" r="45" fill="none"
                  stroke={gradeStyle.color} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black" style={{ color: gradeStyle.color, fontFamily: "var(--font-display)" }}>
                  {report.letter_grade}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {report.overall_percentage.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Score details */}
            <div className="flex-1 w-full">
              <div className="flex flex-wrap gap-3 mb-4">
                <div className="px-4 py-2 rounded-xl" style={{ background: `${gradeStyle.color}1a`, border: `1px solid ${gradeStyle.color}33` }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: gradeStyle.color, fontFamily: "var(--font-display)" }}>
                    {report.raw_points.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", marginLeft: 4 }}>
                    / {report.max_possible_points} pts
                  </span>
                </div>
              </div>
              {/* Agent badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {report.agents_used.map((a) => (
                  <span key={a} className="px-2 py-1 rounded-full text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    <Users size={10} className="inline mr-1" />{a}
                  </span>
                ))}
              </div>
              {/* Quick stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <StatPill label="Words" value={stats.word_count} icon={FileText} />
                <StatPill label="Citations" value={stats.citation_count} icon={BarChart2} />
                <StatPill label="Sections" value={stats.sections_detected.length || "-"} icon={TrendingUp} />
                <StatPill
                  label="Headers"
                  value={stats.has_section_headers ? "✓ Yes" : "✗ No"}
                  icon={AlertCircle}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Strengths */}
        {report.top_strengths.length > 0 && (
          <div className="glass-card p-5 mb-6 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50">
            <div className="flex items-center gap-2 mb-3">
              <Star size={15} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold font-display text-emerald-800 dark:text-emerald-300">
                Top Strengths
              </h3>
            </div>
            <ul className="space-y-2">
              {report.top_strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-emerald-900 dark:text-emerald-100">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="tab-bar mb-6 print:hidden">
          <button type="button" className={`tab-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}>
            <BarChart2 size={13} className="inline mr-1" />Overview
          </button>
          <button type="button" className={`tab-item ${activeTab === "criteria" ? "active" : ""}`}
            onClick={() => setActiveTab("criteria")}>
            Criteria Breakdown
          </button>
          <button type="button" className={`tab-item ${activeTab === "revision" ? "active" : ""}`}
            onClick={() => setActiveTab("revision")}>
            Revision Plan
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 print:block">
            <div className="hidden lg:flex justify-center mb-8">
              <RadarChart criteria={report.criteria_breakdown} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {report.criteria_breakdown.map((c) => (
                <div key={c.criterion_id} className="glass-card p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold">{c.criterion_title}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.percentage >= 75 ? "var(--color-success)" : "var(--color-warning)" }}>
                      {c.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="score-bar-track">
                    <div className="score-bar-fill" style={{
                      width: `${c.percentage}%`,
                      background: c.percentage >= 75
                        ? "var(--color-success)"
                        : c.percentage >= 55
                        ? "var(--color-warning)"
                        : "var(--color-error)"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "criteria" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 print:block">
            {report.criteria_breakdown.map((c, i) => (
              <CriterionCard 
                key={c.criterion_id} 
                criterion={c} 
                index={i} 
                onQuoteClick={(quote) => {
                  setHighlightedQuote(quote === highlightedQuote ? null : quote);
                }}
                isQuoteActive={(quote) => quote === highlightedQuote}
              />
            ))}
          </div>
        )}

        {activeTab === "revision" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 print:block">
            <RevisionChecklist report={report} />
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25-.25 4-2.75 4v3c0 1 0 1 1 1z"/>
    </svg>
  );
}
