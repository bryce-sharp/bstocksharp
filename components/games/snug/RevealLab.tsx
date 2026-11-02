// A dev lab for the end-of-month reveal: sample months finished in different ways, how a day finished later looks,
// and the reveal that stitches the outline around what you made. Sample months are from before launch, so nothing spoils.

import { useEffect, useMemo, useRef, useState } from "react";
import { BINDING, YARNS } from "./quilt";
import { Btn, FONT, INK, KnitDefs, QuiltBackdrop, RED_THREAD, SCRIPT, panelStyle, PanelStitches } from "./parts";
import { SNUG_FONTS } from "./fonts";
import { generateOutlineMonth, type Outline } from "./outline";
import { OUTLINES } from "./MonthLab";
import { LATE_THREAD, MonthQuiltView, RevealSequence, drawMonthPicture, monthScore, type QuiltDay } from "./monthQuilt";
import { canvasFonts } from "./share";
import { MonthTimes } from "./statsView";

const SAMPLE_MONTH = "2025-03";
/** The day the "during the month" view is looked at. */
const PEEK_DAY = 24;

type Scenario = "perfect" | "caught-up" | "completed" | "most" | "half";
const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "perfect", label: "Every day, on the day" },
  { id: "caught-up", label: "All done, some later" },
  { id: "completed", label: "Last square just stitched" },
  { id: "most", label: "Most of the month" },
  { id: "half", label: "Half the month" },
];
type SampleDay = Omit<QuiltDay, "pieces" | "scoredGaps" | "bestGaps" | "late" | "run">;

/** How the sample player finished day `i` (0-based) in a scenario. */
function finish(scenario: Scenario, i: number): "on" | "late" | "holes" | "missed" {
  if (scenario === "perfect") return "on";
  if (scenario === "half") return i < 15 ? "on" : "missed";
  if (scenario === "caught-up" || scenario === "completed") return i % 5 === 3 ? "late" : "on";
  if ([8, 16, 22, 27].includes(i)) return "missed";
  if ([4, 12].includes(i)) return "holes";
  return i % 7 === 2 ? "late" : "on";
}

function sampleDay(d: SampleDay, how: ReturnType<typeof finish>, i: number): QuiltDay {
  if (how === "missed") return { ...d };
  let pieces = Object.entries(d.puzzle.solution).map(([id, s]) => ({ id, cells: s.cells, color: d.puzzle.pieces.find((p) => p.id === id)!.color, at: { x: s.x, y: s.y } }));
  let gaps = 0;
  if (how === "holes") {
    gaps = pieces[0]!.cells.length;
    pieces = pieces.slice(1);
  }
  // Sample times between about a minute and seven minutes.
  const run = { dateKey: d.dateKey, timeMs: 50_000 + ((i * 7919) % 23) * 17_000, gaps, hints: i % 6 === 0 ? 1 : 0 };
  return how === "late" ? { ...d, pieces, bestGaps: 0, late: true } : { ...d, pieces, scoredGaps: gaps, bestGaps: gaps, run };
}

export function RevealLab() {
  const [outline, setOutline] = useState<Outline>("pumpkin");
  const [scenario, setScenario] = useState<Scenario>("most");
  const [month, setMonth] = useState<{ minX: number; minY: number; width: number; height: number; days: SampleDay[] } | null>(null);
  const [busy, setBusy] = useState(true);

  // Generating takes a few seconds, so the busy note paints first.
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (let seed = 0; ; seed++) {
        try {
          const q = generateOutlineMonth(SAMPLE_MONTH, outline, YARNS.length, `reveal-${seed}`);
          setMonth({ minX: q.minX, minY: q.minY, width: q.width, height: q.height, days: q.days });
          break;
        } catch {
          // Try the next seed.
        }
      }
      setBusy(false);
    }, 30);
    return () => window.clearTimeout(t);
  }, [outline]);

  const days = useMemo(() => (month ? month.days.map((d, i) => sampleDay(d, finish(scenario, i), i)) : []), [month, scenario]);
  // The month's last late day is the one that just finished it.
  const completedDay = scenario === "completed" ? days.filter((d) => d.late).at(-1)?.dateKey : undefined;
  const peek = useMemo(() => days.slice(0, PEEK_DAY), [days]);
  const shape = month ? { outline, minX: month.minX, minY: month.minY, width: month.width, height: month.height } : undefined;

  // "Share picture" here draws the real picture and shows it on the page instead of sharing it.
  const rootRef = useRef<HTMLDivElement>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const showPicture = async () => {
    if (!shape || !rootRef.current) return;
    const fonts = await canvasFonts(rootRef.current);
    setPicture(drawMonthPicture(SAMPLE_MONTH, days, shape, monthScore(days), fonts).toDataURL("image/png"));
  };

  return (
    <div ref={rootRef} className={SNUG_FONTS} style={{ fontFamily: FONT, color: INK, display: "grid", gap: 24 }}>
      <QuiltBackdrop dateKey="2026-09-15" />
      <KnitDefs />
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="reveal-head" />
        <h1 style={{ fontFamily: SCRIPT, fontSize: 44, margin: 0, color: BINDING }}>Reveal lab</h1>
        <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 14px" }}>
          A sample month finished four ways, with days finished later in a pale running stitch, and the end-of-month reveal. Sample puzzles only; nothing here is a real day.
        </p>
        <Row label="Picture">
          {OUTLINES.map((o) => (
            <Btn
              key={o}
              small
              primary={o === outline}
              onClick={() => {
                if (o === outline) return;
                setBusy(true);
                setOutline(o);
              }}
            >
              {o}
            </Btn>
          ))}
        </Row>
        <Row label="How the month went">
          {SCENARIOS.map((s) => (
            <Btn key={s.id} small primary={s.id === scenario} onClick={() => setScenario(s.id)}>
              {s.label}
            </Btn>
          ))}
        </Row>
      </section>

      {busy || !month || !shape ? (
        <section style={{ ...panelStyle, width: "100%", textAlign: "center", fontFamily: SCRIPT, fontSize: 26, color: BINDING }}>Sewing a month…</section>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <section style={{ ...panelStyle, flex: "1 1 380px" }}>
            <PanelStitches seed="reveal-peek" />
            <h2 style={{ fontFamily: SCRIPT, fontSize: 32, margin: 0, color: BINDING }}>During the month</h2>
            <p style={{ fontSize: 13.5, opacity: 0.75, margin: "4px 0 14px" }}>The Quilt tab on day {PEEK_DAY}: only finished days, no outline yet.</p>
            <MonthQuiltView monthKey={SAMPLE_MONTH} days={peek} assembled maxWidth={420} />
            <Legend />
          </section>
          <section style={{ ...panelStyle, flex: "1 1 460px" }}>
            <PanelStitches seed="reveal-show" />
            <RevealSequence key={`${outline}-${scenario}`} monthKey={SAMPLE_MONTH} days={days} shape={shape} onShare={() => void showPicture()} onStitch={() => {}} completedDay={completedDay} extra={<MonthTimes runs={days.flatMap((d) => (d.run ? [d.run] : []))} />} />
          </section>
        </div>
      )}
      {picture && (
        <section style={{ ...panelStyle, width: "100%", textAlign: "center" }}>
          <PanelStitches seed="reveal-picture" />
          <h2 style={{ fontFamily: SCRIPT, fontSize: 32, margin: "0 0 12px", color: BINDING }}>The share picture</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- a canvas drawing, not a site image */}
          <img src={picture} alt="The month's share picture" style={{ width: "100%", maxWidth: 432, borderRadius: 8 }} />
        </section>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 150 }}>{label}</span>
      {children}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12.5, marginTop: 12, opacity: 0.8 }}>
      <span><span style={{ color: BINDING, fontWeight: 700 }}>━</span> on the day</span>
      <span><span style={{ color: BINDING, background: BINDING, padding: "0 3px", fontWeight: 700 }}><span style={{ color: LATE_THREAD }}>┅</span></span> finished later</span>
      <span><span style={{ color: RED_THREAD, fontWeight: 700 }}>✕</span> hole</span>
    </div>
  );
}
