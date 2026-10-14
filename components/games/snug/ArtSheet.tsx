import { useEffect, useMemo, type ReactNode } from "react";
import { generatePuzzle } from "./generator";
import { SHAPES, bounds, cellKey } from "./pieces";
import { BINDING, FABRICS, FABRIC_STYLES, YARNS, fabricSwatch } from "./quilt";
import { BoardSvg, Btn, FONT, INK, KnitDefs, PanelStitches, PatchSvg, QuiltBackdrop, ResultCard, SCRIPT, Stat, panelStyle, type PieceState } from "./parts";
import { StitchBorder } from "./stitches";
import { SNUG_FONTS } from "./fonts";
import { QuiltCollection, type CollectionDay } from "./collection";

const CELL = 30;
const BOARD_CELL = 28;
const PAD = 0.45;

/** Every visual element of Snug on one page, for reviewing the art without playing. */
export function SnugArtSheet() {
  const dateKey = ART_DATE;
  const puzzle = useMemo(() => generatePuzzle(dateKey, YARNS.length), [dateKey]);

  const shapeNames = Object.keys(SHAPES);
  const solved = Object.entries(puzzle.solution);
  const half = solved.slice(0, Math.ceil(solved.length / 2));
  const halfCovered = new Set(half.flatMap(([, s]) => s.cells.map(([x, y]) => cellKey(x + s.x, y + s.y))));
  const holes = puzzle.board.filter(([x, y]) => !halfCovered.has(cellKey(x, y)));
  const colorOf = (id: string) => puzzle.pieces.find((p) => p.id === id)!.color;
  const ghostEntry = solved[half.length];

  const boardBox = (children: ReactNode, label: string) => (
    <figure style={{ margin: 0 }}>
      <div style={{ position: "relative", width: (puzzle.cols + 2 * PAD) * BOARD_CELL, height: (puzzle.rows + 2 * PAD) * BOARD_CELL }}>{children}</div>
      <figcaption style={captionStyle}>{label}</figcaption>
    </figure>
  );

  return (
    <div className={SNUG_FONTS} style={{ fontFamily: FONT, color: INK, width: "100%", display: "grid", gap: 24 }}>
      <QuiltBackdrop dateKey={dateKey} />
      <KnitDefs />

      <Section title="Yarn colors" note="One knitted patch per yarn. Each piece gets a different color every day.">
        <div style={wrapRow}>
          {YARNS.map((y, i) => (
            <Labeled key={y.name} label={y.name}>
              <Patch piece={{ id: `yarn-${i}`, cells: SHAPES[shapeNames[i + 7]!]!, color: i, at: null }} />
            </Labeled>
          ))}
        </div>
      </Section>

      <Section title="All piece shapes" note="The 19 base shapes: 2 trominoes, 5 tetrominoes, and 12 pentominoes. Lopsided ones can also arrive mirrored, since players can only turn pieces.">
        <div style={wrapRow}>
          {shapeNames.map((name, i) => (
            <Labeled key={name} label={name}>
              <Patch piece={{ id: `shape-${name}`, cells: SHAPES[name]!, color: i % YARNS.length, at: null }} />
            </Labeled>
          ))}
        </div>
      </Section>

      <Section title="The quilt top" note="Today's board in three states. The binding stitch turns gold and runs on a perfect fill.">
        <div style={wrapRow}>
          {boardBox(
            <>
              <BoardSvg
                board={puzzle.board}
                cols={puzzle.cols}
                rows={puzzle.rows}
                cell={BOARD_CELL}
                pad={PAD}
                ghost={ghostEntry ? { cells: ghostEntry[1].cells.map(([x, y]) => [x + ghostEntry[1].x, y + ghostEntry[1].y] as const), color: colorOf(ghostEntry[0]) } : null}
              />
              {half.map(([id, s]) => (
                <Placed key={id} piece={{ id: `art-mid-${id}`, cells: s.cells, color: colorOf(id), at: { x: s.x, y: s.y } }} />
              ))}
            </>,
            "Mid-game, with a drop preview",
          )}
          {boardBox(
            <>
              <BoardSvg board={puzzle.board} cols={puzzle.cols} rows={puzzle.rows} cell={BOARD_CELL} pad={PAD} holes={holes} />
              {half.map(([id, s]) => (
                <Placed key={id} piece={{ id: `art-holes-${id}`, cells: s.cells, color: colorOf(id), at: { x: s.x, y: s.y } }} />
              ))}
            </>,
            "Tied off with holes",
          )}
          {boardBox(
            <>
              <BoardSvg board={puzzle.board} cols={puzzle.cols} rows={puzzle.rows} cell={BOARD_CELL} pad={PAD} perfect />
              {solved.map(([id, s]) => (
                <Placed key={id} piece={{ id: `art-full-${id}`, cells: s.cells, color: colorOf(id), at: { x: s.x, y: s.y } }} />
              ))}
            </>,
            "Perfectly snug",
          )}
        </div>
      </Section>

      <Section title="Quilt fabrics" note="The seven patch styles the background quilt is sewn from. The mix and colors change each day.">
        <div style={wrapRow}>
          {FABRIC_STYLES.map((name, i) => (
            <Labeled key={name} label={name}>
              <div style={{ width: 120, height: 120, borderRadius: 4, background: fabricSwatch(i, FABRICS[i]!, FABRICS[(i + 4) % FABRICS.length]!) }} />
            </Labeled>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {FABRICS.map((c) => (
            <div key={c} title={c} style={{ width: 28, height: 28, borderRadius: 6, background: c, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
          ))}
        </div>
      </Section>

      <Section title="Interface" note="Stat pills, buttons, the basket, and both result cards.">
        <div style={{ ...wrapRow, alignItems: "center" }}>
          <Stat label="Holes" value="12" />
          <Stat label="Time" value="2:41" />
          <Labeled label="Turned where it does not fit">
            <Patch piece={{ id: "art-loose", cells: SHAPES.T5!, color: 5, at: null }} loose />
          </Labeled>
          <Btn onClick={() => {}}>Turn</Btn>
          <Btn onClick={() => {}} disabled>
            Turn
          </Btn>
          <Btn primary onClick={() => {}}>
            Tie it off
          </Btn>
          <div
            style={{
              width: 180,
              height: 90,
              borderRadius: 18,
              background: "repeating-linear-gradient(45deg, #d8b98d 0 6px, #cfae80 6px 12px), #d8b98d",
              boxShadow: "inset 0 2px 10px rgba(80,45,20,.35)",
              position: "relative",
              display: "grid",
              placeItems: "center",
              fontSize: 13,
            }}
          >
            <StitchBorder inset={7} radius={12} color="#8a5a3c" width={2} stitch={6} gap={4} seed="art-basket" />
            Basket
          </div>
        </div>
        <div style={{ ...wrapRow, marginTop: 18 }}>
          {[0, 3].map((gaps) => (
            <div key={gaps} style={{ position: "relative", width: 440, maxWidth: "100%", height: 470 }}>
              <ResultCard
                number={1}
                result={{ gaps, timeMs: 161_000 }}
                recorded={{ gaps, timeMs: 161_000, pieces: [] }}
                isReplay={false}
                shareLine={`Snug #1: ${gaps === 0 ? "perfectly snug" : `${gaps} holes`} in 2:41`}
                copied={false}
                describe={() => ""}
                onCopy={() => {}}
                onReveal={() => {}}
                onShowMine={() => {}}
                onPlayAgain={() => {}}
                onClose={() => {}}
                stats={{ played: 12, perfect: 9, streak: 4, bestStreak: 7 }}
                moreGames={{ href: "/games", newTab: false }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Quilt collection" note="The calendar draws each finished day as a small quilt. Sample data from before launch, so no playable quilt is shown solved.">
        <QuiltCollection month={ART_DATE.slice(0, 7)} days={sampleDays} />
      </Section>
    </div>
  );
}

const wrapRow = { display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" } as const;
const captionStyle = { fontSize: 13, opacity: 0.7, marginTop: 8, textTransform: "capitalize" } as const;

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section style={{ ...panelStyle, maxWidth: 1080, width: "100%" }}>
      <PanelStitches seed={`art:${title}`} />
      <h2 style={{ fontFamily: SCRIPT, fontSize: 40, lineHeight: 1, margin: 0, color: BINDING }}>{title}</h2>
      <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 18px" }}>{note}</p>
      {children}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "grid", justifyItems: "center" }}>
      {children}
      <figcaption style={captionStyle}>{label}</figcaption>
    </figure>
  );
}

function Patch({ piece, loose = false }: { piece: PieceState; loose?: boolean }) {
  return (
    <div style={{ filter: loose ? "drop-shadow(0 12px 10px rgba(40,20,10,.4))" : "drop-shadow(0 2px 2px rgba(40,20,10,.35))" }}>
      <PatchSvg piece={piece} cell={CELL} interactive={false} loose={loose} onDown={() => {}} />
    </div>
  );
}

function Placed({ piece }: { piece: PieceState }) {
  const { w, h } = bounds(piece.cells);
  return (
    <div
      style={{
        position: "absolute",
        left: (PAD + piece.at!.x) * BOARD_CELL,
        top: (PAD + piece.at!.y) * BOARD_CELL,
        width: w * BOARD_CELL,
        height: h * BOARD_CELL,
        filter: "drop-shadow(0 2px 2px rgba(40,20,10,.35))",
      }}
    >
      <PatchSvg piece={piece} cell={BOARD_CELL} interactive={false} onDown={() => {}} />
    </div>
  );
}


/** Examples come from a day before launch, which can never be played, so nothing here spoils a real quilt. */
const ART_DATE = "2026-09-15";

/** September 2026 (before launch) from each day's own solution: most perfect, some missing a patch, a few unplayed. */
const sampleDays: CollectionDay[] = Array.from({ length: 30 }, (_, i) => {
  const dateKey = `2026-09-${String(i + 1).padStart(2, "0")}`;
  if (i % 9 === 4) return { dateKey };
  const puzzle = generatePuzzle(dateKey, YARNS.length);
  const solved = Object.entries(puzzle.solution);
  const skip = i % 5 === 2 ? solved[0]![0] : null;
  const pieces = solved.map(([id, s]) => ({ id, cells: s.cells, color: puzzle.pieces.find((p) => p.id === id)!.color, at: id === skip ? null : { x: s.x, y: s.y } }));
  const holes = skip ? puzzle.solution[skip]!.cells.length : 0;
  return { dateKey, pieces, holes };
});
