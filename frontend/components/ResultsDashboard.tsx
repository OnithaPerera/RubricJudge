"use client";

import { useState } from "react";
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
} from "lucide-react";
import { FinalConsensusReport } from "@/lib/types";
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
    <div className="glass-card px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "hsla(248,87%,61%,0.15)" }}>
        <Icon size={15} style={{ color: "var(--color-brand-400)" }} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</p>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{value}</p>
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
    `- **Estimated Score:** ${report.estimated_overall_score} / ${report.max_possible_score} (${report.percentage.toFixed(1)}%)`,
    `- **Letter Grade:** ${report.letter_grade}`,
    ``,
    `## Top Strengths`,
    ...report.top_strengths.map((s) => `- ${s}`),
    ``,
    `## Priority Improvements`,
    ...report.priority_improvements.map((s, i) => `${i + 1}. ${s}`),
    ``,
    `## Guiding Questions for Revision`,
    ...report.guiding_questions_for_revision.map((q, i) => `**Q${i + 1}.** ${q}`),
    ``,
    `## Criteria Breakdown`,
  ];

  report.criteria_breakdown.forEach((c) => {
    lines.push(`### ${c.criterion_title} — ${c.final_score.toFixed(1)}/${c.max_score} (${c.percentage.toFixed(0)}%)`);
    if (c.critique) lines.push(`**Critique:** ${c.critique}`);
    if (c.actionable_revision_prompts.length) {
      lines.push(`**Revision Prompts:**`);
      c.actionable_revision_prompts.forEach((p) => lines.push(`- ${p}`));
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

export default function ResultsDashboard({ report, onReset, draftText }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const gradeStyle = getGradeStyle(report.letter_grade);
  const stats = report.deterministic_stats;

  const circumference = 2 * Math.PI * 45; // r=45
  const strokeDashoffset = circumference - (report.percentage / 100) * circumference;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 slide-up">
        <div>
          <h2 className="text-3xl font-bold gradient-text" style={{ fontFamily: "var(--font-display)" }}>
            Evaluation Report
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            {report.disclaimer}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => exportMarkdown(report)}>
            <Download size={14} />
            Export .md
          </button>
          <button type="button" className="btn-ghost" onClick={onReset}>
            <RefreshCcw size={14} />
            New Evaluation
          </button>
        </div>
      </div>

      {/* Score hero card */}
      <div className="glass-card p-6 mb-6 slide-up slide-up-delay-1">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          {/* SVG score ring */}
          <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="60" cy="60" r="45" fill="none"
                stroke="var(--surface-3)" strokeWidth="10" />
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
                {report.percentage.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Score details */}
          <div className="flex-1">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="px-4 py-2 rounded-xl" style={{ background: `${gradeStyle.color}1a`, border: `1px solid ${gradeStyle.color}33` }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: gradeStyle.color, fontFamily: "var(--font-display)" }}>
                  {report.estimated_overall_score.toFixed(1)}
                </span>
                <span style={{ fontSize: 14, color: "var(--text-muted)", marginLeft: 4 }}>
                  / {report.max_possible_score} pts
                </span>
              </div>
            </div>
            {/* Agent badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {report.agents_used.map((a) => (
                <span key={a} className="px-2 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                  <Users size={10} className="inline mr-1" />{a}
                </span>
              ))}
            </div>
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatPill label="Words" value={stats.word_count} icon={FileText} />
              <StatPill label="Citations" value={stats.citation_count} icon={BarChart2} />
              <StatPill label="Sections" value={stats.sections_detected.length || "—"} icon={TrendingUp} />
              <StatPill
                label="Headers"
                value={stats.has_section_headers ? "✓ Present" : "✗ Missing"}
                icon={AlertCircle}
              />
            </div>
          </div>

          {/* Radar chart */}
          <div className="hidden lg:block flex-shrink-0" style={{ width: 220 }}>
            <RadarChart criteria={report.criteria_breakdown} />
          </div>
        </div>
      </div>

      {/* Strengths */}
      {report.top_strengths.length > 0 && (
        <div className="glass-card p-5 mb-6 slide-up slide-up-delay-2">
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} style={{ color: "var(--accent-b)" }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Top Strengths
            </h3>
          </div>
          <ul className="space-y-2">
            {report.top_strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle size={14} style={{ color: "var(--color-success)", marginTop: 3, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Discrepancies */}
      {report.consensus_discrepancies.length > 0 && (
        <div className="glass-card p-5 mb-6 slide-up slide-up-delay-2"
          style={{ borderColor: "hsla(38,92%,60%,0.3)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} style={{ color: "var(--accent-b)" }} />
            <h3 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--accent-b)" }}>
              Agent Disagreements (Reconciled)
            </h3>
          </div>
          <ul className="space-y-1">
            {report.consensus_discrepancies.map((d, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)" }}>• {d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar mb-6 slide-up slide-up-delay-3">
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
        <div className="slide-up">
          <RadarChart criteria={report.criteria_breakdown} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {report.criteria_breakdown.map((c) => (
              <div key={c.criterion_id} className="glass-card p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold">{c.criterion_title}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.percentage >= 75 ? "var(--color-success)" : "var(--accent-b)" }}>
                    {c.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="score-bar-track">
                  <div className="score-bar-fill" style={{
                    width: `${c.percentage}%`,
                    background: c.percentage >= 75
                      ? "linear-gradient(90deg, hsl(142,70%,35%), hsl(142,70%,55%))"
                      : c.percentage >= 55
                      ? "linear-gradient(90deg, hsl(38,92%,40%), hsl(38,92%,60%))"
                      : "linear-gradient(90deg, hsl(0,75%,38%), hsl(0,75%,58%))"
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "criteria" && (
        <div className="space-y-3 slide-up">
          {report.criteria_breakdown.map((c, i) => (
            <CriterionCard key={c.criterion_id} criterion={c} index={i} draftText={draftText} />
          ))}
        </div>
      )}

      {activeTab === "revision" && (
        <div className="slide-up">
          <RevisionChecklist report={report} />
        </div>
      )}
    </div>
  );
}
