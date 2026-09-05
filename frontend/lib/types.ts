/**
 * RubricJudge — Shared TypeScript Types
 * Mirrors the Pydantic v2 models from backend/models.py
 */

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  weight_percentage: number;
  max_score: number;
  levels: Record<string, string>;
  category: "content_argumentation" | "structure_formatting" | "task_fulfillment" | "other";
}

export interface NormalizedRubric {
  assignment_title: string;
  total_points: number;
  criteria: RubricCriterion[];
}

export interface DeterministicStats {
  word_count: number;
  paragraph_count: number;
  sentence_count: number;
  has_section_headers: boolean;
  citation_count: number;
  citation_density: number;
  avg_words_per_sentence: number;
  sections_detected: string[];
}

export interface ReconciledCriterionScore {
  criterion_id: string;
  criterion_title: string;
  final_score: number;
  max_score: number;
  percentage: number;
  agent_scores: Record<string, number>;
  was_reconciled: boolean;
  arbitration_reasoning: string | null;
  confidence: number;
  evidence_quotes: string[];
  critique: string;
  actionable_revision_prompts: string[];
}

export interface FinalConsensusReport {
  estimated_overall_score: number;
  max_possible_score: number;
  percentage: number;
  letter_grade: string;
  deterministic_stats: DeterministicStats;
  criteria_breakdown: ReconciledCriterionScore[];
  consensus_discrepancies: string[];
  top_strengths: string[];
  priority_improvements: string[];
  guiding_questions_for_revision: string[];
  agents_used: string[];
  disclaimer: string;
}

export type PipelineStage =
  | "parsing_rubric"
  | "preflight_checks"
  | "running_specialist_judges"
  | "arbitrating_discrepancies"
  | "generating_final_report"
  | "completed"
  | "failed";

export interface StreamProgressEvent {
  job_id: string;
  stage: PipelineStage;
  progress_percentage: number;
  active_agent: string | null;
  message: string;
  timestamp: string;
  result?: FinalConsensusReport;
  error?: string;
}

export interface AgentStatus {
  name: string;
  label: string;
  status: "idle" | "running" | "done" | "failed";
  message?: string;
}

export interface EvaluationJobResponse {
  job_id: string;
  message: string;
  stream_url: string;
}

// Sample data for quick testing
export const SAMPLE_RUBRIC = `
Assignment: Critical Analysis Essay – Climate Change Policy

1. Thesis & Argument (25 points): Student presents a clear, specific, and arguable thesis statement. The argument is logically structured and consistently maintained throughout the essay.
   - Excellent (23-25): Compelling, nuanced thesis with sophisticated argumentation
   - Satisfactory (16-22): Clear thesis present but argument inconsistently applied
   - Poor (0-15): Thesis absent, unclear, or argument is contradictory

2. Evidence & Research Integration (25 points): Uses a minimum of 6 peer-reviewed sources. Evidence is accurately cited, relevant, and effectively integrated to support claims.
   - Excellent (23-25): Outstanding use of diverse, credible sources with seamless integration
   - Satisfactory (16-22): Adequate sources present but integration could be stronger
   - Poor (0-15): Insufficient sources, misrepresented evidence, or no citations

3. Critical Analysis & Depth (25 points): Demonstrates higher-order thinking. Engages with counterarguments, acknowledges limitations, and moves beyond surface-level description.
   - Excellent (23-25): Sophisticated analysis, engages meaningfully with counter-positions
   - Satisfactory (16-22): Some analysis present but lacks depth or ignores counterarguments
   - Poor (0-15): Primarily descriptive, no critical engagement

4. Structure & Academic Writing (15 points): Essay is logically organised with clear introduction, body paragraphs, and conclusion. Academic tone maintained throughout. Smooth transitions between ideas.
   - Excellent (14-15): Exemplary structure, professional academic writing style
   - Satisfactory (10-13): Adequate structure with some organisational issues
   - Poor (0-9): Disorganised, informal tone, poor paragraph construction

5. Citation Format & Bibliography (10 points): All sources cited correctly in APA 7th edition. Reference list complete, formatted consistently.
   - Excellent (10): Perfect APA formatting throughout
   - Satisfactory (7-9): Minor APA errors that don't impede understanding
   - Poor (0-6): Significant citation errors, missing references, or inconsistent format
`.trim();

export const SAMPLE_DRAFT = `
Climate Change Policy: A Critical Analysis of Carbon Pricing Mechanisms

Introduction

Climate change represents one of the most pressing challenges facing contemporary policymakers. Among the various policy instruments available, carbon pricing has emerged as a prominent mechanism for reducing greenhouse gas emissions. This essay argues that while carbon pricing schemes offer theoretical economic efficiency, their practical implementation is fraught with political, distributional, and efficacy challenges that significantly undermine their effectiveness as standalone policy tools.

The Economic Case for Carbon Pricing

The foundational justification for carbon pricing derives from Pigouvian tax theory, which posits that externalities can be corrected by imposing costs equal to the marginal social damage (Pigou, 1920). Contemporary applications include carbon taxes and emissions trading schemes (ETS). The European Union's ETS, launched in 2005, represents the world's largest carbon market, covering approximately 40% of the EU's greenhouse gas emissions (European Commission, 2023).

Proponents argue that carbon pricing provides economic efficiency by allowing emission reductions to occur where they are least costly (Nordhaus, 2017). This market-based logic suggests that a universal carbon price signals to all economic actors simultaneously, avoiding the micro-management inherent in regulatory approaches. Furthermore, revenues generated can be recycled as dividends or tax reductions.

However, the empirical record is more ambiguous. A meta-analysis by Lilliestam et al. (2021) found that the EU ETS reduced emissions by approximately 3-4% relative to counterfactual scenarios during its first three phases, a figure substantially below initial projections. The study attributes this underperformance to persistent price volatility and the political pressures that result in excessive permit allocation.

Distributional Consequences and Political Economy

A critical weakness of carbon pricing that advocates frequently understate is its regressive distributional impact. Lower-income households spend a higher proportion of their income on energy-intensive goods, meaning carbon taxes impose disproportionate burdens on vulnerable populations (Goulder et al., 2019). This distributional concern has real political consequences.

The Yellow Vest movement in France (2018-2019) provides a compelling case study. When the Macron government announced increases to the carbon tax on fuel, the resulting protests, which drew hundreds of thousands of participants, forced a policy reversal. This episode illustrates how economically optimal policies can prove politically unsustainable when they ignore equity dimensions.

Conclusion

Carbon pricing remains a theoretically sound instrument within a broader climate policy portfolio. However, the evidence suggests that relying on price signals alone is insufficient. Future policy frameworks must integrate complementary regulatory standards, technology investment, and carefully designed revenue recycling to address distributional concerns. The question for policymakers is not whether to price carbon, but how to embed pricing within a coherent, equitable policy architecture.

References

European Commission. (2023). EU Emissions Trading System. https://climate.ec.europa.eu/eu-action/eu-emissions-trading-system-eu-ets_en

Goulder, L. H., Hafstead, M. A., Kim, G., & Long, X. (2019). Impacts of a carbon tax across US household income groups. Journal of Public Economics, 175, 44-64.

Lilliestam, J., Patt, A., & Bersalli, G. (2021). The effect of carbon pricing on technological change for full energy decarbonization. WIREs Climate Change, 12(1), e681.

Nordhaus, W. (2017). Revisiting the social cost of carbon. Proceedings of the National Academy of Sciences, 114(7), 1518-1523.

Pigou, A. C. (1920). The Economics of Welfare. Macmillan.
`.trim();
