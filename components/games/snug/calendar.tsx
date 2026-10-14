import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays } from "../daily";
import { BINDING, LINEN } from "./quilt";
import { Btn, GOLD_THREAD, INK, RED_THREAD, RUST_THREAD, SCRIPT, StitchedModal } from "./parts";
import { dayRecord, type DayRecord } from "./records";
import type { Puzzle } from "./generator";
import { loadMonth, type MonthDays, type MonthShape } from "./puzzles";
import { QuiltThumb } from "./collection";
import { MonthQuiltView, MonthScoreView, monthScore, quiltDays, type MonthScore, type QuiltDay } from "./monthQuilt";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const GOLD_FILL = "#e2b03e";

const monthOf = (key: string) => key.slice(0, 7);
const keyOf = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, m! - 1 + by, 1);
  return keyOf(d.getFullYear(), d.getMonth() + 1, 1).slice(0, 7);
}

function Check({ color }: { color: string }) {
  return (
    <svg width={12} height={10} viewBox="0 0 12 10" aria-hidden>
      <path d="M1.5 5.5L4.5 8.5L10.5 1.5" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The corner badge on a day: a gold check for perfect later, the hole count for runs with holes. */
function Mark({ record }: { record: DayRecord }) {
  switch (record.status) {
    case "completedLater":
      return <Check color={GOLD_THREAD} />;
    case "holes":
      return <span style={{ fontSize: 10, fontWeight: 700, color: RED_THREAD }}>{record.holes}</span>;
    case "tried":
      return <span style={{ fontSize: 10, fontWeight: 600, color: RUST_THREAD, opacity: 0.7 }}>{record.holes}</span>;
    default:
      return null;
  }
}

const cellLook = (record: DayRecord) => {
  if (record.status === "perfect") return { background: LINEN, border: `2px solid ${GOLD_FILL}`, color: INK };
  if (record.status === "inProgress") return { background: LINEN, border: `2px dashed ${RUST_THREAD}`, color: INK };
  if (record.pieces) return { background: LINEN, border: "2px solid rgba(123,59,46,.15)", color: INK };
  return { background: "rgba(123,59,46,.07)", border: "2px solid transparent", color: INK };
};

/** A played day's quilt, drawn small on the day's board. */
function DayQuilt({ puzzle, record }: { puzzle: Puzzle; record: DayRecord }) {
  return <QuiltThumb board={puzzle.board} cols={puzzle.cols} rows={puzzle.rows} pieces={record.pieces!} size="70%" />;
}

function Legend({ swatch, children }: { swatch: DayRecord; children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
      <span style={{ ...cellLook(swatch), width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", boxSizing: "border-box" }}>
        <Mark record={swatch} />
      </span>
      {children}
    </span>
  );
}

type MonthQuilt = { monthKey: string; days: QuiltDay[]; score: MonthScore; shape?: MonthShape };

/** The Quilt tab: the month so far as one quilt, or the finished month with its score and a replay of its reveal. */
function MonthPanel({ quilt, over, onReveal }: { quilt: MonthQuilt | null; over: boolean; onReveal: () => void }) {
  if (!quilt) {
    return <div style={{ minHeight: 200, display: "grid", placeItems: "center", fontFamily: SCRIPT, fontSize: 24, color: BINDING }}>Laying out the month…</div>;
  }
  const finished = quilt.days.filter((d) => d.pieces).length;
  return (
    <div>
      {finished || quilt.shape ? (
        <MonthQuiltView monthKey={quilt.monthKey} days={quilt.days} shape={quilt.shape} assembled maxWidth={380} />
      ) : (
        <div style={{ textAlign: "center", fontSize: 14, opacity: 0.75, padding: "30px 0" }}>Finish a day and its quilt takes its place here.</div>
      )}
      <div style={{ marginTop: 16 }}>
        {over ? (
          <>
            <MonthScoreView score={quilt.score} />
            {finished > 0 && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
                <Btn small primary onClick={onReveal}>
                  Play the reveal
                </Btn>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.75 }}>
            {finished} {finished === 1 ? "day" : "days"} stitched so far. The month&apos;s shape shows when it ends.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A month of quilts: each day shows how you did, and tapping one jumps to it. The Quilt tab shows the month as one
 * quilt: finished days only while the month runs, the whole outline once it is over.
 */
export function QuiltCalendar({
  current,
  today,
  launch,
  onPick,
  onReveal,
  onClose,
}: {
  current: string;
  today: string;
  launch: string;
  onPick: (key: string) => void;
  onReveal: (month: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(monthOf(current));
  const [view, setView] = useState<"days" | "quilt">("days");
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const first = new Date(y, m - 1, 1).getDay();
  const daysIn = new Date(y, m, 0).getDate();
  const records = useMemo(() => {
    const out = new Map<string, DayRecord>();
    for (let d = 1; d <= daysIn; d++) {
      const key = keyOf(y, m, d);
      if (key >= launch && key <= today) out.set(key, dayRecord(key));
    }
    return out;
  }, [y, m, daysIn, launch, today]);

  // The month's boards, for drawing each played day's quilt; days show their number until they arrive.
  const [data, setData] = useState<MonthDays | null>(null);
  useEffect(() => {
    let live = true;
    const last = keyOf(y, m, daysIn);
    loadMonth(month, last < today ? last : today)
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [month, y, m, daysIn, today]);
  const boards = useMemo(() => (data?.monthKey === month ? new Map<string, Puzzle>(data.days.map((d) => [d.dateKey, d.puzzle])) : null), [data, month]);
  // The outline stays hidden until the month is over, even when the server already sends every day.
  const over = month < monthOf(today);
  const quilt = useMemo((): MonthQuilt | null => {
    if (view !== "quilt" || data?.monthKey !== month) return null;
    const days = quiltDays(data).filter((d) => d.dateKey <= today);
    return { monthKey: month, days, score: monthScore(days), shape: over ? data.shape : undefined };
  }, [view, data, month, today, over]);

  // Totals across every day so far, not just this month.
  const totals = useMemo(() => {
    let played = 0;
    let perfect = 0;
    let days = 0;
    for (let k = launch; k <= today; k = addDays(k, 1)) {
      days++;
      const r = dayRecord(k);
      if (r.status === "perfect" || r.status === "completedLater") perfect++;
      if (r.status !== "none" && r.status !== "inProgress") played++;
    }
    return { played, perfect, days };
  }, [launch, today]);

  const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const navBtn = (label: string, by: number, disabled: boolean, glyph: string) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => setMonth(shiftMonth(month, by))}
      style={{ border: 0, background: "none", fontSize: 24, lineHeight: 1, color: INK, opacity: disabled ? 0.25 : 0.8, cursor: disabled ? "default" : "pointer", padding: "0 8px" }}
    >
      {glyph}
    </button>
  );
  const tab = (v: "days" | "quilt", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === v}
      onClick={() => setView(v)}
      style={{
        fontFamily: "inherit",
        fontSize: 13.5,
        fontWeight: 500,
        padding: "5px 16px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        color: view === v ? LINEN : INK,
        background: view === v ? BINDING : "rgba(123,59,46,.1)",
      }}
    >
      {label}
    </button>
  );

  return (
    <StitchedModal label="Quilt calendar" onClose={onClose} width={420}>
      <div style={{ fontFamily: SCRIPT, fontSize: 40, lineHeight: 1, color: BINDING, fontWeight: 700, textAlign: "center" }}>Your quilts</div>
      <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.75, marginTop: 6 }}>
        {totals.perfect} perfect &middot; {totals.played} of {totals.days} played
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 4px 8px" }}>
        {navBtn("Previous month", -1, month <= monthOf(launch), "‹")}
        <span style={{ fontWeight: 600 }}>{monthName}</span>
        {navBtn("Next month", 1, month >= monthOf(today), "›")}
      </div>
      <div role="tablist" aria-label="Calendar view" style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
        {tab("days", "Days")}
        {tab("quilt", "Quilt")}
      </div>
      {view === "quilt" ? (
        <MonthPanel quilt={quilt} over={over} onReveal={() => onReveal(month)} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 11, letterSpacing: 1, opacity: 0.55, paddingBottom: 2 }}>
                {w}
              </div>
            ))}
            {Array.from({ length: first }, (_, i) => (
              <span key={`pad${i}`} />
            ))}
            {Array.from({ length: daysIn }, (_, i) => {
              const key = keyOf(y, m, i + 1);
              const record = records.get(key);
              if (!record) {
                return (
                  <div key={key} style={{ aspectRatio: "1", display: "grid", placeItems: "center", fontSize: 13, opacity: 0.25 }}>
                    {i + 1}
                  </div>
                );
              }
              const look = cellLook(record);
              const isCurrent = key === current;
              const board = boards?.get(key);
              const drawn = !!record.pieces && !!board;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${key}: ${record.status}`}
                  onClick={() => onPick(key)}
                  style={{
                    ...look,
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: 9,
                    display: "grid",
                    placeItems: "center",
                    padding: 0,
                    overflow: "hidden",
                    fontFamily: "inherit",
                    fontSize: drawn ? 9 : 14,
                    fontWeight: key === today ? 700 : 500,
                    cursor: "pointer",
                    boxSizing: "border-box",
                    outline: isCurrent ? `2px solid ${BINDING}` : "none",
                    outlineOffset: 2,
                  }}
                >
                  {drawn ? (
                    <>
                      <DayQuilt puzzle={board!} record={record} />
                      <span style={{ position: "absolute", top: 1, left: 3, opacity: 0.6 }}>{i + 1}</span>
                      <span style={{ position: "absolute", bottom: 0, right: 3, lineHeight: 1 }}>
                        <Mark record={record} />
                      </span>
                    </>
                  ) : (
                    i + 1
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 16, justifyContent: "center" }}>
            <Legend swatch={{ status: "perfect" }}>Perfect on the day (gold edge)</Legend>
            <Legend swatch={{ status: "completedLater" }}>Perfect later</Legend>
            <Legend swatch={{ status: "holes", holes: 3 }}>Holes left (scored)</Legend>
            <Legend swatch={{ status: "tried", holes: 3 }}>Holes left (practice)</Legend>
            <Legend swatch={{ status: "inProgress" }}>In progress</Legend>
          </div>
        </>
      )}
    </StitchedModal>
  );
}
