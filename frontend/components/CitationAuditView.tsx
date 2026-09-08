import { CheckCircle2, XCircle, AlertTriangle, FileText, ExternalLink } from "lucide-react";
import { CitationAuditReport, CitationValidationItem } from "@/lib/types";

export default function CitationAuditView({ audit }: { audit: CitationAuditReport }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex flex-col gap-1 border-t-4" style={{ borderColor: "var(--color-brand-500)" }}>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Style</span>
          <span className="text-2xl font-black font-display text-foreground">{audit.referencing_style}</span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-1 border-t-4" style={{ borderColor: "var(--color-success)" }}>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">DOIs Verified</span>
          <span className="text-2xl font-black font-display text-success flex items-center gap-2">
            <CheckCircle2 size={20} /> {audit.active_dois_verified}
          </span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-1 border-t-4" style={{ borderColor: audit.broken_dois_found > 0 ? "var(--color-error)" : "var(--color-success)" }}>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Broken DOIs</span>
          <span className="text-2xl font-black font-display text-error flex items-center gap-2">
            {audit.broken_dois_found > 0 ? <XCircle size={20} /> : <CheckCircle2 size={20} className="text-success" />} {audit.broken_dois_found}
          </span>
        </div>
        <div className="glass-card p-4 flex flex-col gap-1 border-t-4" style={{ borderColor: (audit.orphan_references.length > 0 || audit.missing_in_text_citations.length > 0) ? "var(--color-warning)" : "var(--color-success)" }}>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Cross-Check Issues</span>
          <span className="text-2xl font-black font-display text-warning flex items-center gap-2">
            {(audit.orphan_references.length > 0 || audit.missing_in_text_citations.length > 0) ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} className="text-success" />} 
            {audit.orphan_references.length + audit.missing_in_text_citations.length}
          </span>
        </div>
      </div>

      {/* Cross-Check Issues */}
      {(audit.orphan_references.length > 0 || audit.missing_in_text_citations.length > 0) && (
        <div className="glass-card p-5 bg-warning/5 border-warning/20">
          <h3 className="text-md font-bold mb-3 flex items-center gap-2 text-warning-800 dark:text-warning-300">
            <AlertTriangle size={16} /> Reference List vs In-Text Discrepancies
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {audit.orphan_references.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Orphan References (In List, Not Cited)</h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-zinc-700 dark:text-zinc-300">
                  {audit.orphan_references.map((ref, i) => <li key={i}>{ref}</li>)}
                </ul>
              </div>
            )}
            {audit.missing_in_text_citations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Missing References (Cited, Not In List)</h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-zinc-700 dark:text-zinc-300">
                  {audit.missing_in_text_citations.map((cit, i) => <li key={i}>{cit}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Citation Items list */}
      <h3 className="text-lg font-bold font-display mt-8 mb-4">Detailed Source Audit</h3>
      <div className="space-y-4">
        {audit.items.map((item, idx) => (
          <div key={idx} className="glass-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex-shrink-0">
                <FileText size={18} className="text-zinc-400" />
              </div>
              <div className="flex-1 w-full overflow-hidden">
                <p className="text-sm font-medium text-foreground mb-3 leading-relaxed break-words">{item.raw_citation}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {/* Formatting Analysis */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-border">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Format Analysis</span>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">{item.formatting_critique}</p>
                    {item.suggested_format && item.suggested_format !== item.raw_citation && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <span className="text-xs font-semibold text-zinc-500 mb-1 block">Suggested Format:</span>
                        <p className="text-sm text-brand-600 dark:text-brand-400 font-medium break-words">{item.suggested_format}</p>
                      </div>
                    )}
                  </div>

                  {/* DOI Status */}
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-border">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">DOI Status</span>
                    {item.doi ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300 font-mono">{item.doi}</span>
                          <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer" className="text-brand-500 hover:text-brand-600">
                            <ExternalLink size={14} />
                          </a>
                        </div>
                        {item.doi_valid === true && (
                          <div className="flex items-center gap-1.5 text-sm text-success font-medium">
                            <CheckCircle2 size={16} /> Verified Active
                          </div>
                        )}
                        {item.doi_valid === false && (
                          <div className="flex items-center gap-1.5 text-sm text-error font-medium">
                            <XCircle size={16} /> Broken or Unreachable
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-500 italic mt-2">No DOI detected</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
