"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { BookOpen, FileText, Upload, X, Zap, ChevronRight } from "lucide-react";
import { SAMPLE_DRAFT, SAMPLE_RUBRIC } from "@/lib/types";

interface InputPanelProps {
  onSubmit: (draftText: string, rubricText: string, assignmentTitle: string, draftFile?: File | null, rubricFile?: File | null) => void;
  isLoading: boolean;
}

interface FileState {
  name: string;
  size: number;
  rawFile: File;
  text?: string;
}

export default function InputPanel({ onSubmit, isLoading }: InputPanelProps) {
  const [rubricText, setRubricText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [rubricFile, setRubricFile] = useState<FileState | null>(null);
  const [draftFile, setDraftFile] = useState<FileState | null>(null);
  const [rubricDragging, setRubricDragging] = useState(false);
  const [draftDragging, setDraftDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"paste" | "upload">("paste");
  const rubricInputRef = useRef<HTMLInputElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);

  const loadSample = () => {
    setRubricText(SAMPLE_RUBRIC);
    setDraftText(SAMPLE_DRAFT);
    setAssignmentTitle("Critical Analysis Essay – Climate Change Policy");
    setRubricFile(null);
    setDraftFile(null);
  };

  const hasRubric = Boolean(rubricFile || rubricText.trim().length > 20);
  const hasDraft = Boolean(draftFile || draftText.trim().split(/\s+/).length >= 30);
  const canSubmit = hasRubric && hasDraft;

  const handleFileSelect = (
    file: File,
    setter: (f: FileState | null) => void,
  ) => {
    if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setter({ name: file.name, size: file.size, rawFile: file, text: e.target?.result as string });
      };
      reader.readAsText(file);
    } else {
      setter({ name: file.name, size: file.size, rawFile: file });
    }
  };

  const handleDrop = (
    e: DragEvent<HTMLDivElement>,
    setter: (f: FileState | null) => void,
    setDragging: (v: boolean) => void,
  ) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file, setter);
  };

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (f: FileState | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file, setter);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(
      draftFile?.text || draftText,
      rubricFile?.text || rubricText,
      assignmentTitle,
      draftFile?.rawFile,
      rubricFile?.rawFile
    );
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10 slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4"
          style={{ background: "hsla(248,87%,61%,0.12)", border: "1px solid hsla(248,87%,61%,0.3)" }}>
          <Zap size={14} style={{ color: "var(--color-brand-400)" }} />
          <span style={{ color: "var(--color-brand-400)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em" }}>
            MULTI-AGENT AI EVALUATION
          </span>
        </div>
        <h1 className="text-5xl font-bold mb-4 gradient-text" style={{ fontFamily: "var(--font-display)" }}>
          RubricJudge
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 17, maxWidth: 560, margin: "0 auto" }}>
          Submit your rubric and assignment draft. A committee of four specialist AI agents
          will evaluate, debate, and produce a diagnostic report.
        </p>
      </div>

      {/* Assignment title + sample button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 slide-up slide-up-delay-1">
        <div className="flex-1 w-full">
          <input
            type="text"
            value={assignmentTitle}
            onChange={(e) => setAssignmentTitle(e.target.value)}
            placeholder="Assignment title (optional)"
            className="rj-textarea"
            style={{ height: "44px", resize: "none", paddingTop: "10px", paddingBottom: "10px" }}
          />
        </div>
        <button type="button" onClick={loadSample} className="btn-ghost whitespace-nowrap flex-shrink-0">
          <BookOpen size={14} />
          Load Sample
        </button>
      </div>

      {/* Tab bar */}
      <div className="tab-bar mb-6 slide-up slide-up-delay-1" style={{ maxWidth: 280 }}>
        <button type="button" className={`tab-item ${activeTab === "paste" ? "active" : ""}`}
          onClick={() => setActiveTab("paste")}>Paste Text</button>
        <button type="button" className={`tab-item ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}>Upload File</button>
      </div>

      {/* Two-column input */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8 slide-up slide-up-delay-2">

        {/* Rubric Panel */}
        <div className="glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "hsla(186,85%,56%,0.15)" }}>
              <BookOpen size={15} style={{ color: "var(--accent-a)" }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                Evaluation Rubric
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Paste or upload your assignment rubric
              </p>
            </div>
          </div>

          {activeTab === "paste" ? (
            <textarea
              value={rubricText}
              onChange={(e) => setRubricText(e.target.value)}
              className="rj-textarea"
              rows={14}
              placeholder="Paste your rubric here…&#10;&#10;Example:&#10;1. Thesis Statement (25 pts): Clear, arguable thesis…&#10;2. Evidence (25 pts): Minimum 6 peer-reviewed sources…"
            />
          ) : (
            <div
              className={`drop-zone flex flex-col items-center justify-center gap-3 ${rubricDragging ? "dragging" : ""}`}
              style={{ minHeight: 200 }}
              onDragOver={(e) => { e.preventDefault(); setRubricDragging(true); }}
              onDragLeave={() => setRubricDragging(false)}
              onDrop={(e) => handleDrop(e, setRubricFile, setRubricDragging)}
              onClick={() => rubricInputRef.current?.click()}
            >
              <input ref={rubricInputRef} type="file" accept=".txt,.md,.pdf,.docx"
                className="hidden" onChange={(e) => handleFileChange(e, setRubricFile)} />
              {rubricFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={18} style={{ color: "var(--accent-a)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{rubricFile.name}</span>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); setRubricFile(null); }}
                    className="p-1 rounded-full hover:opacity-70">
                    <X size={14} style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--text-muted)" }} />
                  <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    Drop PDF, DOCX, or TXT file here
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>or click to browse</p>
                </>
              )}
            </div>
          )}

          {/* Word count indicator */}
          <div className="flex justify-end" style={{ marginTop: -4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {(rubricFile?.text || rubricText).split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
        </div>

        {/* Draft Panel */}
        <div className="glass-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "hsla(280,80%,68%,0.15)" }}>
              <FileText size={15} style={{ color: "var(--accent-c)" }} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>
                Assignment Draft
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                Paste or upload your assignment for evaluation
              </p>
            </div>
          </div>

          {activeTab === "paste" ? (
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="rj-textarea"
              rows={14}
              placeholder="Paste your assignment draft here…&#10;&#10;Minimum 30 words required for evaluation."
            />
          ) : (
            <div
              className={`drop-zone flex flex-col items-center justify-center gap-3 ${draftDragging ? "dragging" : ""}`}
              style={{ minHeight: 200 }}
              onDragOver={(e) => { e.preventDefault(); setDraftDragging(true); }}
              onDragLeave={() => setDraftDragging(false)}
              onDrop={(e) => handleDrop(e, setDraftFile, setDraftDragging)}
              onClick={() => draftInputRef.current?.click()}
            >
              <input ref={draftInputRef} type="file" accept=".txt,.md,.pdf,.docx"
                className="hidden" onChange={(e) => handleFileChange(e, setDraftFile)} />
              {draftFile ? (
                <div className="flex items-center gap-2">
                  <FileText size={18} style={{ color: "var(--accent-c)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{draftFile.name}</span>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); setDraftFile(null); }}
                    className="p-1 rounded-full hover:opacity-70">
                    <X size={14} style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--text-muted)" }} />
                  <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    Drop PDF, DOCX, or TXT file here
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>or click to browse</p>
                </>
              )}
            </div>
          )}

          <div className="flex justify-between" style={{ marginTop: -4 }}>
            <span style={{ fontSize: 11, color: (draftFile?.text || draftText).split(/\s+/).filter(Boolean).length < 30 ? "var(--color-warning)" : "var(--text-muted)" }}>
              {(draftFile?.text || draftText).split(/\s+/).filter(Boolean).length} words
              {(draftFile?.text || draftText).split(/\s+/).filter(Boolean).length < 30 && " (min 30)"}
            </span>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-3 slide-up slide-up-delay-3">
        <button type="submit" className="btn-primary" disabled={!canSubmit || isLoading}
          style={{ minWidth: 260, height: 52 }}>
          {isLoading ? (
            <>
              <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Launching Evaluation Committee…
            </>
          ) : (
            <>
              Run Multi-Agent Evaluation
              <ChevronRight size={18} />
            </>
          )}
        </button>
        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", maxWidth: 440 }}>
          By submitting, you acknowledge this is a diagnostic tool. Results are AI-generated
          and do not constitute official academic assessment.
        </p>
      </div>
    </form>
  );
}
