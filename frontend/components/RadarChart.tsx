"use client";

import {
  Radar,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CriterionEvaluation } from "@/lib/types";

interface RadarChartProps {
  criteria: CriterionEvaluation[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { subject: string; percentage: number } }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div
        className="glass-card px-3 py-2"
        style={{ fontSize: 12, minWidth: 120 }}
      >
        <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
          {d.subject}
        </p>
        <p style={{ color: "var(--color-brand-400)" }}>
          Score: {d.percentage.toFixed(0)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function RadarChart({ criteria }: RadarChartProps) {
  const data = criteria
    .filter((c) => c.max_score > 0 && !c.is_advisory)
    .map((c) => ({
      subject:
        c.criterion_title.length > 18
          ? c.criterion_title.slice(0, 16) + "…"
          : c.criterion_title,
      fullTitle: c.criterion_title,
      percentage: c.percentage,
      score: c.assigned_score,
      max: c.max_score,
    }));

  if (data.length < 3) {
    return (
      <div className="flex items-center justify-center h-48"
        style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Radar chart requires at least 3 criteria
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ReRadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid
            gridType="polygon"
            stroke="hsla(240,30%,50%,0.18)"
            strokeWidth={1}
          />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: "hsl(215,20%,55%)",
              fontSize: 11,
              fontFamily: "var(--font-inter)",
            }}
          />
          <Radar
            name="Score"
            dataKey="percentage"
            stroke="hsl(248,87%,71%)"
            strokeWidth={2}
            fill="hsl(248,87%,61%)"
            fillOpacity={0.25}
            dot={{
              fill: "hsl(248,87%,71%)",
              r: 4,
              strokeWidth: 0,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
