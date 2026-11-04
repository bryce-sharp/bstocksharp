"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { ScatterChart } from "@mui/x-charts/ScatterChart";
import { ChartsReferenceLine } from "@mui/x-charts/ChartsReferenceLine";
import { chart } from "@/app/tokens";
import { useMounted } from "@/components/shared/useMounted";
import type { RecipeLogEntry } from "@/lib/queries/recipes";
import { color } from "./tokens";

const at = (key: string) => new Date(`${key}T12:00:00`).getTime();
const DAY = 86_400_000;

/** Every counted rating over time, one color per person, with a line where each new version starts. */
export default function RatingsChart({ logs }: { logs: RecipeLogEntry[] }) {
  const mounted = useMounted();
  const rated = logs.filter((l) => l.counted && l.rating !== null);

  const series = React.useMemo(() => {
    const people = new Map<number, { name: string; color: string; data: { x: number; y: number; id: number }[] }>();
    for (const l of rated) {
      const p = people.get(l.profileId) ?? { name: l.person, color: l.color ?? chart.light[people.size % chart.light.length]!, data: [] };
      p.data.push({ x: at(l.cookedOn), y: l.rating!, id: l.id });
      people.set(l.profileId, p);
    }
    return [...people].map(([id, p]) => ({
      id: String(id),
      label: p.name,
      color: p.color,
      data: p.data,
      markerSize: 6,
      // The hover label reads "Mar 14, 2026 · 2 stars" instead of the raw point.
      valueFormatter: (v: { x: number; y: number } | null) =>
        v ? `${new Date(v.x).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${v.y === 1 ? "1 star" : `${v.y} stars`}` : "",
    }));
  }, [rated]);

  // A version's line sits on the first day it was cooked.
  const versions = React.useMemo(() => {
    const first = new Map<number, string>();
    for (const l of logs) if (!first.has(l.recipeVersion) || l.cookedOn < first.get(l.recipeVersion)!) first.set(l.recipeVersion, l.cookedOn);
    const lowest = Math.min(...first.keys());
    return [...first].filter(([v]) => v !== lowest).map(([v, day]) => ({ v, x: at(day) }));
  }, [logs]);

  if (rated.length < 2) return null;
  const xs = logs.map((l) => at(l.cookedOn));
  const min = Math.min(...xs) - 7 * DAY;
  const max = Math.max(...xs) + 7 * DAY;

  return (
    <Box sx={{ minHeight: 250, mx: -1, mb: 1 }} role="img" aria-label={`Chart of ${rated.length} ratings over time`}>
      {mounted && (
        <ScatterChart
          height={220}
          series={series}
          xAxis={[{ scaleType: "time", min, max, valueFormatter: (v: number) => new Date(v).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) }]}
          yAxis={[{ min: 0.5, max: 5.5, tickInterval: [1, 2, 3, 4, 5], width: 28 }]}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
          sx={{ "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: color.rule }, "& .MuiChartsAxis-tickLabel": { fill: color.muted } }}
        >
          {versions.map(({ v, x }) => (
            <ChartsReferenceLine
              key={v}
              x={x}
              label={`Version ${v}`}
              labelAlign="start"
              lineStyle={{ stroke: color.second, strokeDasharray: "4 4" }}
              // Past the middle, the label sits left of its line so the edge never clips it.
              labelStyle={{ fill: color.second, fontSize: 11, textAnchor: (x - min) / (max - min) > 0.5 ? "end" : "start" }}
            />
          ))}
        </ScatterChart>
      )}
    </Box>
  );
}
