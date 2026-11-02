// Snug's stats on screen: a month's times, how everyone did on a day or in a month, and the all-time Stats tab.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDuration } from "../daily";
import { loadSnugDayCrowd, loadSnugMonthCrowd, type DayCrowd, type MonthCrowd } from "@/app/actions/snug";
import { BINDING } from "./quilt";
import { INK, SCRIPT, hintsUsed, plural, type RunSummary } from "./parts";
import { TIMES_OF_DAY, allTimeStats, monthStats, type TimedDay } from "./stats";

const PERFECT = "#2e8f83";
const BAR_BG = "rgba(123,59,46,.1)";

const dayName = (dateKey: string) => new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const time = (ms: number | null) => (ms === null ? "–" : formatDuration(ms));

function Figure({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div style={{ minWidth: 70, textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", opacity: 0.65 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ fontFamily: SCRIPT, fontSize: 24, color: BINDING, textAlign: "center", lineHeight: 1.1 }}>{title}</div>
      {note && <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center", marginTop: 2 }}>{note}</div>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </section>
  );
}

const Row = ({ children }: { children: ReactNode }) => <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 8px" }}>{children}</div>;

/** A month's times from its scored perfect runs: fastest, typical, average and slowest, then days played. */
export function MonthTimes({ runs }: { runs: TimedDay[] }) {
  const s = useMemo(() => monthStats(runs), [runs]);
  if (!s.played) return null;
  return (
    <Section title="Your times" note={s.times ? `From ${plural(s.times.count, "perfect day")} on the day` : undefined}>
      {s.times ? (
        <Row>
          <Figure label="Fastest" value={time(s.times.fastest.timeMs)} sub={dayName(s.times.fastest.dateKey)} />
          <Figure label="Typical" value={time(s.times.medianMs)} sub="middle time" />
          <Figure label="Average" value={time(s.times.meanMs)} />
          <Figure label="Slowest" value={time(s.times.slowest.timeMs)} sub={dayName(s.times.slowest.dateKey)} />
        </Row>
      ) : (
        <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.75 }}>No perfect days on the day to time yet.</div>
      )}
      <div style={{ textAlign: "center", fontSize: 13, opacity: 0.8, marginTop: 10 }}>
        {plural(s.played, "day")} played on the day &middot; {s.longestRun} in a row at most &middot; {plural(s.hints, "hint")}
      </div>
    </Section>
  );
}

/** Loads one of everyone's totals, keeping the last answer while a new one loads. */
function useCrowd<T>(load: () => Promise<T>, key: string): T | null | "error" {
  const [state, setState] = useState<{ key: string; value: T | "error" } | null>(null);
  useEffect(() => {
    let live = true;
    load()
      .then((value) => live && setState({ key, value }))
      .catch(() => live && setState({ key, value: "error" }));
    return () => {
      live = false;
    };
    // `key` names everything `load` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.value : null;
}

const notEnough = (players: number) => `Not enough players yet: ${plural(players, "player")} so far. Stats show from 3 players.`;

/** How everyone did in a month. */
export function MonthCrowdView({ monthKey }: { monthKey: string }) {
  const crowd = useCrowd<MonthCrowd>(() => loadSnugMonthCrowd(monthKey), monthKey);
  return (
    <Section title="Everyone this month" note={crowd && crowd !== "error" ? plural(crowd.players, "player") : undefined}>
      {crowd === null ? (
        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.6 }}>Counting…</div>
      ) : crowd === "error" ? (
        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.6 }}>Could not load everyone&apos;s numbers.</div>
      ) : !crowd.enough ? (
        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.75 }}>{notEnough(crowd.players)}</div>
      ) : (
        <Row>
          <Figure label="Days played" value={crowd.medianDays ?? "–"} sub="typical player" />
          <Figure label="Typical time" value={time(crowd.medianMs)} sub={`average ${time(crowd.meanMs)}`} />
          {crowd.completed !== null && <Figure label="Quilts done" value={crowd.completed} />}
          {crowd.perfectMonths !== null && <Figure label="Perfect months" value={crowd.perfectMonths} />}
        </Row>
      )}
    </Section>
  );
}

/** Under a finished day: how everyone did, and how this run compares when it is the scored one. */
export function DayCrowdLine({ dateKey, run, scored }: { dateKey: string; run: RunSummary; scored: boolean }) {
  const mine = { gaps: run.gaps, hints: hintsUsed(run), timeMs: run.timeMs };
  const crowd = useCrowd<DayCrowd>(() => loadSnugDayCrowd(dateKey, scored ? mine : undefined), `${dateKey}|${scored}|${mine.gaps}|${mine.hints}|${mine.timeMs}`);
  if (crowd === null || crowd === "error") return null;
  if (!crowd.enough) return <div style={{ fontSize: 12.5, marginTop: 10, opacity: 0.7 }}>{notEnough(crowd.players)}</div>;
  return (
    <div style={{ fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>
      {crowd.beat !== null && (
        <div style={{ fontWeight: 600 }}>
          You beat {Math.round(crowd.beat * 100)}% of other players
        </div>
      )}
      <div style={{ opacity: 0.8 }}>
        {plural(crowd.players, "player")} &middot; {crowd.perfect} perfect &middot; typical {time(crowd.medianMs)} (average {time(crowd.meanMs)})
      </div>
      {!scored && <div style={{ opacity: 0.65, fontSize: 12 }}>Practice runs do not count toward these.</div>}
    </div>
  );
}

/** Horizontal bars with their values written beside them, one per row. */
function Bars({ rows }: { rows: { label: string; value: number; text: string; color?: string; title: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: "6px 10px", fontSize: 13 }}>
      {rows.map((r) => (
        <div key={r.label} title={r.title} style={{ display: "contents" }}>
          <span style={{ textAlign: "right", opacity: 0.8 }}>{r.label}</span>
          <span style={{ height: 14, borderRadius: 4, background: BAR_BG, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, borderRadius: 4, background: r.color ?? BINDING }} />
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Recent perfect times as a line, with the typical time dashed across it. */
function TimeLine({ runs, medianMs }: { runs: TimedDay[]; medianMs: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320;
  const H = 110;
  const pad = { l: 34, r: 8, t: 10, b: 18 };
  const max = Math.max(...runs.map((r) => r.timeMs)) * 1.1;
  const x = (i: number) => pad.l + (runs.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (runs.length - 1)) * (W - pad.l - pad.r));
  const y = (ms: number) => pad.t + (1 - ms / max) * (H - pad.t - pad.b);
  const h = hover === null ? null : runs[hover]!;
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Your last ${runs.length} perfect times; typical ${formatDuration(medianMs)}`} onMouseLeave={() => setHover(null)}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={INK} strokeOpacity={0.2} />
        <text x={pad.l - 4} y={y(max / 1.1)} fontSize={9} textAnchor="end" dominantBaseline="middle" fill={INK} opacity={0.6}>
          {formatDuration(max / 1.1)}
        </text>
        <text x={pad.l - 4} y={H - pad.b} fontSize={9} textAnchor="end" dominantBaseline="middle" fill={INK} opacity={0.6}>
          0:00
        </text>
        <line x1={pad.l} x2={W - pad.r} y1={y(medianMs)} y2={y(medianMs)} stroke={BINDING} strokeOpacity={0.55} strokeDasharray="4 3" />
        <text x={pad.l + 3} y={y(medianMs) - 4} fontSize={9} fill={INK} opacity={0.7}>
          typical {formatDuration(medianMs)}
        </text>
        <polyline points={runs.map((r, i) => `${x(i)},${y(r.timeMs)}`).join(" ")} fill="none" stroke={BINDING} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {runs.map((r, i) => (
          <g key={r.dateKey} onMouseEnter={() => setHover(i)}>
            <circle cx={x(i)} cy={y(r.timeMs)} r={i === hover ? 4.5 : 3} fill={BINDING} stroke="#f5ead6" strokeWidth={1.5} />
            {/* A wider target than the dot, so hovering is easy. */}
            <rect x={x(i) - 6} y={pad.t} width={12} height={H - pad.t - pad.b} fill="transparent" />
          </g>
        ))}
        <text x={pad.l} y={H - 4} fontSize={9} fill={INK} opacity={0.6}>
          {dayName(runs[0]!.dateKey)}
        </text>
        <text x={W - pad.r} y={H - 4} fontSize={9} textAnchor="end" fill={INK} opacity={0.6}>
          {dayName(runs.at(-1)!.dateKey)}
        </text>
      </svg>
      {h && (
        <div
          style={{
            position: "absolute",
            left: `${(x(hover!) / W) * 100}%`,
            top: 0,
            transform: "translate(-50%, -100%)",
            background: INK,
            color: "#f5ead6",
            fontSize: 12,
            padding: "3px 8px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {dayName(h.dateKey)}: {formatDuration(h.timeMs)}
        </div>
      )}
    </div>
  );
}

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px dashed rgba(123,59,46,.25)`, fontSize: 13.5 }}>
    <span style={{ opacity: 0.8 }}>{label}</span>
    <span style={{ fontWeight: 600, textAlign: "right" }}>{children}</span>
  </div>
);

/** The calendar's Stats tab: every scored day so far. */
export function StatsPanel({ launch, today }: { launch: string; today: string }) {
  const s = useMemo(() => allTimeStats(launch, today), [launch, today]);
  if (!s.runs.length) return <div style={{ textAlign: "center", fontSize: 14, opacity: 0.75, padding: "30px 0" }}>Finish a day on its date and your stats start here.</div>;
  const perfect = s.holes[0]!;
  const timed = TIMES_OF_DAY.reduce((n, t) => n + s.timesOfDay[t], 0);
  const mostly = timed ? TIMES_OF_DAY.reduce((a, t) => (s.timesOfDay[t] > s.timesOfDay[a] ? t : a)) : null;
  return (
    <div style={{ color: INK }}>
      <Row>
        <Figure label="Played" value={s.runs.length} sub="on the day" />
        <Figure label="Perfect" value={`${Math.round((perfect / s.runs.length) * 100)}%`} />
        <Figure label="Squares" value={s.squares.toLocaleString()} sub="stitched" />
        <Figure label="Longest run" value={s.longestRun} sub="days in a row" />
      </Row>

      <Section title="Holes left" note="Each day's scored run">
        <Bars
          rows={["Perfect", "1 hole", "2 holes", "3 holes", "4 or more"].map((label, i) => ({
            label,
            value: s.holes[i]!,
            text: String(s.holes[i]),
            color: i === 0 ? PERFECT : undefined,
            title: `${label}: ${plural(s.holes[i]!, "day")}`,
          }))}
        />
      </Section>

      {s.byLevel.length > 0 && (
        <Section title="Time by difficulty" note="Typical time on perfect days; average after it">
          <Bars
            rows={s.byLevel.map((l) => ({
              label: l.name,
              value: l.medianMs,
              text: `${formatDuration(l.medianMs)} · ${formatDuration(l.meanMs)}`,
              title: `${l.name}: typical ${formatDuration(l.medianMs)}, average ${formatDuration(l.meanMs)} over ${plural(l.count, "day")}`,
            }))}
          />
        </Section>
      )}

      {s.times && s.recent.length > 1 && (
        <Section title="Your recent times" note={`Last ${plural(s.recent.length, "perfect day")}`}>
          <TimeLine runs={s.recent} medianMs={s.times.medianMs} />
        </Section>
      )}

      <Section title="Fun facts">
        {s.times && (
          <Fact label="Fastest ever">
            {formatDuration(s.times.fastest.timeMs)} on {dayName(s.times.fastest.dateKey)}
          </Fact>
        )}
        {s.times && (
          <Fact label="Slowest perfect day">
            {formatDuration(s.times.slowest.timeMs)} on {dayName(s.times.slowest.dateKey)}
          </Fact>
        )}
        <Fact label="You play mostly">{mostly ? `in the ${mostly.toLowerCase()}` : "Counts from your next finish"}</Fact>
        {timed > 0 && (
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <Bars rows={TIMES_OF_DAY.map((t) => ({ label: t, value: s.timesOfDay[t], text: String(s.timesOfDay[t]), title: `${t}: ${plural(s.timesOfDay[t], "day")}` }))} />
          </div>
        )}
        {s.favoriteWeekday && <Fact label="Most played day">{s.favoriteWeekday}</Fact>}
        <Fact label="Perfect with no hints">{plural(s.perfectNoHints, "day")}</Fact>
        <Fact label="Hints used">{s.hints}</Fact>
        <Fact label="Days caught up later">{s.caughtUp}</Fact>
        {timed > 0 && timed < s.runs.length && (
          <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 6 }}>Time of day counts {plural(timed, "day")}; older runs did not record it.</div>
        )}
      </Section>
    </div>
  );
}
