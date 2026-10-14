// Your quilts as a sampler: one small patch per day of the month, each showing the quilt you finished that day.

import { useMemo } from "react";
import { generatePuzzle } from "./generator";
import { cellKey, outlinePath, type Cell } from "./pieces";
import { BINDING, LINEN, YARNS } from "./quilt";
import { GOLD_THREAD, INK, RED_THREAD, SCRIPT, plural, type PieceState } from "./parts";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export interface CollectionDay {
  dateKey: string;
  /** The finished quilt to draw: the scored run, else the best practice run. Absent for unplayed days. */
  pieces?: PieceState[];
  holes?: number;
}

/** A finished quilt drawn small: the board, each patch in its yarn color, holes marked, a gold binding when perfect. */
export function QuiltThumb({ board, cols, rows, pieces, size }: { board: Cell[]; cols: number; rows: number; pieces: PieceState[]; size: number | string }) {
  const filled = new Set<string>();
  for (const p of pieces) if (p.at && !p.loose) for (const [x, y] of p.cells) filled.add(cellKey(x + p.at.x, y + p.at.y));
  const holes = board.filter(([x, y]) => !filled.has(cellKey(x, y)));
  const span = Math.max(cols, rows) + 1;
  return (
    <svg width={size} height={size} viewBox={`${-0.5 - (span - 1 - cols) / 2} ${-0.5 - (span - 1 - rows) / 2} ${span} ${span}`} aria-hidden>
      <path d={outlinePath(board, 1)} fill={LINEN} stroke={holes.length ? BINDING : GOLD_THREAD} strokeWidth={0.32} strokeLinejoin="round" />
      {pieces.map((p) =>
        p.at && !p.loose ? (
          <path
            key={p.id}
            d={outlinePath(
              p.cells.map(([x, y]) => [x + p.at!.x, y + p.at!.y] as Cell),
              1,
            )}
            fill={YARNS[p.color]!.base}
            stroke={YARNS[p.color]!.dark}
            strokeWidth={0.1}
            strokeLinejoin="round"
          />
        ) : null,
      )}
      {holes.map(([x, y]) => (
        <path key={`h${x},${y}`} d={`M${x + 0.32} ${y + 0.32}L${x + 0.68} ${y + 0.68}M${x + 0.68} ${y + 0.32}L${x + 0.32} ${y + 0.68}`} stroke={RED_THREAD} strokeWidth={0.09} strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** One month as a sampler quilt: day patches joined by rust sashing, the way quilters set blocks together. */
export function QuiltCollection({ month, days }: { month: string; days: CollectionDay[] }) {
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const first = new Date(y, m - 1, 1).getDay();
  const byKey = useMemo(() => new Map(days.map((d) => [d.dateKey, d])), [days]);
  const daysIn = new Date(y, m, 0).getDate();
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(7, minmax(0, 92px))", gap: 5, padding: 8, borderRadius: 12, background: BINDING, maxWidth: "100%" }}>
      {WEEKDAYS.map((w, i) => (
        <div key={i} style={{ textAlign: "center", fontSize: 11, letterSpacing: 1, color: LINEN, opacity: 0.8 }}>
          {w}
        </div>
      ))}
      {Array.from({ length: first }, (_, i) => (
        <span key={`pad${i}`} />
      ))}
      {Array.from({ length: daysIn }, (_, i) => {
        const key = `${month}-${String(i + 1).padStart(2, "0")}`;
        return <DayPatch key={key} dateKey={key} day={i + 1} entry={byKey.get(key)} />;
      })}
    </div>
  );
}

function DayPatch({ dateKey, day, entry }: { dateKey: string; day: number; entry?: CollectionDay }) {
  const puzzle = useMemo(() => (entry?.pieces ? generatePuzzle(dateKey, YARNS.length) : null), [dateKey, entry]);
  const played = !!(puzzle && entry?.pieces);
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 6,
        background: played ? LINEN : "rgba(244,234,214,.35)",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <span style={{ position: "absolute", top: 3, left: 5, fontSize: 10, color: INK, opacity: played ? 0.55 : 0.4 }}>{day}</span>
      {played && <QuiltThumb board={puzzle.board} cols={puzzle.cols} rows={puzzle.rows} pieces={entry!.pieces!} size={64} />}
      {played && entry!.holes! > 0 && (
        <span style={{ position: "absolute", bottom: 2, right: 5, fontFamily: SCRIPT, fontSize: 13, fontWeight: 700, color: RED_THREAD }}>{plural(entry!.holes!, "hole")}</span>
      )}
    </div>
  );
}
