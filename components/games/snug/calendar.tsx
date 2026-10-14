import { useMemo, useState, type ReactNode } from "react";
import { addDays } from "../daily";
import { BINDING, LINEN, YARNS } from "./quilt";
import { GOLD_THREAD, INK, RED_THREAD, RUST_THREAD, SCRIPT, StitchedModal } from "./parts";
import { dayRecord, type DayRecord } from "./records";
import { generatePuzzle } from "./generator";
import { QuiltThumb } from "./collection";

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

/** A played day's quilt, drawn small; the board comes from the day's puzzle. */
function DayQuilt({ dateKey, record }: { dateKey: string; record: DayRecord }) {
  const puzzle = useMemo(() => generatePuzzle(dateKey, YARNS.length), [dateKey]);
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

/** A month of quilts: each day shows how you did, and tapping one jumps to it. */
export function QuiltCalendar({
  current,
  today,
  launch,
  onPick,
  onClose,
}: {
  current: string;
  today: string;
  launch: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(monthOf(current));
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
          const quilt = !!record.pieces;
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
                fontSize: quilt ? 9 : 14,
                fontWeight: key === today ? 700 : 500,
                cursor: "pointer",
                boxSizing: "border-box",
                outline: isCurrent ? `2px solid ${BINDING}` : "none",
                outlineOffset: 2,
              }}
            >
              {quilt ? (
                <>
                  <DayQuilt dateKey={key} record={record} />
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
    </StitchedModal>
  );
}
