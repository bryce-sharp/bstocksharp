"use client";

// The sound lab's tune maker: a piano roll for the music-box tune and its low notes, kept in step with the text form.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { BINDING } from "./quilt";
import { Btn, INK } from "./parts";
import { VOICES, midiName, previewNote, readNotes, watchBeat, writeNotes, type Note, type Tune, type Voice } from "./sounds";

const STEP_W = 24;
const ROW_H = 18;
const KEYS_W = 44;
const BLACK = new Set([1, 3, 6, 8, 10]);
const GOLD = "#f6c445";
const BRUSHES: [string, number][] = [
  ["Eighth", 1],
  ["Quarter", 2],
  ["Dotted quarter", 3],
  ["Half", 4],
  ["Whole bar", 8],
];

/** Adds `n`, one note at a time: a note it lands inside is cut short, and it stops where the next note starts. */
function place(notes: Note[], n: Note, steps: number): Note[] {
  const kept = notes
    .filter((o) => o.start !== n.start)
    .map((o) => (o.start < n.start && o.start + o.len > n.start ? { ...o, len: n.start - o.start } : o));
  const next = Math.min(steps, ...kept.filter((o) => o.start > n.start).map((o) => o.start));
  return [...kept, { ...n, len: Math.max(1, Math.min(n.len, next - n.start)) }];
}

type Drag = { kind: "new" | "move" | "resize"; base: Note[]; note: Note; grab: number; moved: boolean; pointer: number };

function PianoRoll({
  label,
  text,
  onChange,
  low,
  bar,
  brush,
  beat,
  voice,
}: {
  label: string;
  text: string;
  onChange: (text: string) => void;
  low: boolean;
  bar: number;
  brush: number;
  beat: number | null;
  voice: Voice;
}) {
  const { notes, steps: played } = readNotes(text);
  const steps = Math.max(bar, Math.ceil(played / bar) * bar);
  const [lo, hi] = low ? [41, 52] : [65, 86];
  const top = Math.max(hi, ...notes.map((n) => n.midi));
  const bottom = Math.min(lo, ...notes.map((n) => n.midi));
  const rows = Array.from({ length: top - bottom + 1 }, (_, i) => top - i);
  const grid = useRef<HTMLDivElement>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  // Pointer events can outrun renders, so handlers read the drag from here.
  const live = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    live.current = d;
    setDragState(d);
  };

  const shown = drag ? (drag.kind === "move" && !drag.moved ? notes : place(drag.base, drag.note, steps)) : notes;
  const at = beat === null || !played ? null : beat % played;

  const cell = (e: ReactPointerEvent) => {
    const r = grid.current!.getBoundingClientRect();
    const col = Math.max(0, Math.min(steps - 1, Math.floor((e.clientX - r.left) / STEP_W)));
    const row = Math.max(0, Math.min(rows.length - 1, Math.floor((e.clientY - r.top) / ROW_H)));
    return { col, midi: rows[row]! };
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    grid.current!.setPointerCapture(e.pointerId);
    const { col, midi } = cell(e);
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-note]");
    const i = target ? Number(target.dataset.note) : -1;
    if (i >= 0) {
      const hit = notes[i]!;
      const base = notes.filter((_, j) => j !== i);
      const edge = (e.target as HTMLElement).dataset.edge === "1";
      setDrag({ kind: edge ? "resize" : "move", base, note: hit, grab: col - hit.start, moved: false, pointer: e.pointerId });
      return;
    }
    previewNote(midi, low, voice);
    setDrag({ kind: "new", base: notes, note: { midi, start: col, len: Math.min(brush, steps - col) }, grab: 0, moved: false, pointer: e.pointerId });
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = live.current;
    if (!drag || e.pointerId !== drag.pointer) return;
    const { col, midi } = cell(e);
    const { note } = drag;
    let next = note;
    if (drag.kind === "move") {
      next = { ...note, midi, start: Math.max(0, Math.min(steps - note.len, col - drag.grab)) };
      if (next.midi !== note.midi) previewNote(next.midi, low, voice);
    } else if (drag.kind === "resize" || col !== note.start) {
      next = { ...note, len: Math.max(1, Math.min(steps - note.start, col - note.start + 1)) };
    }
    if (next.midi !== note.midi || next.start !== note.start || next.len !== note.len) setDrag({ ...drag, note: next, moved: true });
  };

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = live.current;
    if (!drag || e.pointerId !== drag.pointer) return;
    // A note pressed and let go without moving comes off.
    if (drag.kind === "move" && !drag.moved) onChange(writeNotes(drag.base, steps));
    else onChange(writeNotes(place(drag.base, drag.note, steps), steps));
    setDrag(null);
  };

  const resize = (bars: number) => {
    const next = Math.max(bar, steps + bars * bar);
    onChange(writeNotes(notes.filter((n) => n.start < next).map((n) => ({ ...n, len: Math.min(n.len, next - n.start) })), next));
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, opacity: 0.75 }}>
          {steps / bar} {steps / bar === 1 ? "bar" : "bars"}
        </span>
        <span style={{ flex: 1 }} />
        <Btn small tight disabled={steps <= bar} onClick={() => resize(-1)} label={`${label}: one bar shorter`}>
          − bar
        </Btn>
        <Btn small tight disabled={steps >= 256} onClick={() => resize(1)} label={`${label}: one bar longer`}>
          + bar
        </Btn>
        <Btn small tight disabled={!notes.length} onClick={() => onChange(writeNotes([], steps))} label={`Clear ${label}`}>
          Clear
        </Btn>
      </div>
      <div style={{ overflowX: "auto", borderRadius: 10, border: `1.5px solid ${BINDING}`, background: "#fffaf0" }}>
        <div style={{ display: "flex", width: KEYS_W + steps * STEP_W }}>
          <div style={{ position: "sticky", left: 0, zIndex: 3, width: KEYS_W, flex: "none", background: "#f3e6d0", borderRight: `1.5px solid ${BINDING}` }}>
            {rows.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => previewNote(m, low, voice)}
                aria-label={`Hear ${midiName(m)}`}
                style={{
                  display: "block",
                  width: "100%",
                  height: ROW_H,
                  padding: "0 6px",
                  border: "none",
                  borderBottom: "1px solid rgba(123,59,46,.12)",
                  textAlign: "right",
                  font: "inherit",
                  fontSize: 10,
                  lineHeight: `${ROW_H - 1}px`,
                  cursor: "pointer",
                  color: BLACK.has(m % 12) ? "#fff8ec" : INK,
                  background: BLACK.has(m % 12) ? "#6b4a3a" : m % 12 === 0 ? "#fbefd9" : "transparent",
                  fontWeight: m % 12 === 0 ? 700 : 400,
                }}
              >
                {midiName(m)}
              </button>
            ))}
          </div>
          <div
            ref={grid}
            role="grid"
            aria-label={`${label} notes`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDrag(null)}
            style={{ position: "relative", width: steps * STEP_W, height: rows.length * ROW_H, cursor: "crosshair", touchAction: "none", userSelect: "none" }}
          >
            {rows.map((m, r) => (
              <div
                key={m}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: r * ROW_H,
                  height: ROW_H,
                  borderBottom: "1px solid rgba(123,59,46,.08)",
                  background: BLACK.has(m % 12) ? "rgba(107,74,58,.09)" : "transparent",
                }}
              />
            ))}
            {Array.from({ length: steps }, (_, s) => (
              <div
                key={s}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: s * STEP_W,
                  width: 1,
                  background: s % bar === 0 ? "rgba(123,59,46,.45)" : s % 2 === 0 ? "rgba(123,59,46,.16)" : "rgba(123,59,46,.06)",
                }}
              />
            ))}
            {at !== null && (
              <div style={{ position: "absolute", top: 0, bottom: 0, left: at * STEP_W, width: STEP_W, background: "rgba(246,196,69,.35)", pointerEvents: "none" }} />
            )}
            {shown.map((n, i) => {
              const r = rows.indexOf(n.midi);
              const sounding = at !== null && at >= n.start && at < n.start + n.len;
              const ghost = !!drag && drag.moved && n === drag.note;
              return (
                <div
                  key={`${n.start}-${n.midi}-${i}`}
                  data-note={drag ? undefined : i}
                  title={`${midiName(n.midi)}, ${n.len} ${n.len === 1 ? "eighth" : "eighths"}`}
                  style={{
                    position: "absolute",
                    left: n.start * STEP_W + 1,
                    top: r * ROW_H + 1,
                    width: n.len * STEP_W - 2,
                    height: ROW_H - 2,
                    borderRadius: 5,
                    background: sounding ? GOLD : low ? "#8a5a44" : BINDING,
                    boxShadow: sounding ? `0 0 8px ${GOLD}` : "inset 0 -2px 0 rgba(0,0,0,.18)",
                    opacity: ghost ? 0.75 : 1,
                    color: sounding ? INK : "#fff8ec",
                    fontSize: 10,
                    lineHeight: `${ROW_H - 2}px`,
                    paddingLeft: 4,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    cursor: "grab",
                    zIndex: 2,
                  }}
                >
                  {n.len * STEP_W > 30 ? midiName(n.midi) : ""}
                  <div data-edge="1" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 7, cursor: "ew-resize", borderLeft: "1px solid rgba(255,255,255,.35)" }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

type Saving = {
  /** The track the tune came from, which Save writes over; null for a tune that is not saved anywhere. */
  sourceName: string | null;
  dirty: boolean;
  onSave: () => void;
  onSaveNew: (name: string) => void;
  nextName: string;
};

/** The tune maker: play and save controls, the two piano rolls, and the tune as text. */
export function TuneEditor({ tune, onChange, playing, onToggle, saving }: { tune: Tune; onChange: (tune: Tune) => void; playing: boolean; onToggle: () => void; saving: Saving }) {
  const [brush, setBrush] = useState(2);
  const [naming, setNaming] = useState<string | null>(null);
  const voice = tune.voice ?? "musicbox";
  const saveNew = () => {
    if (!naming?.trim()) return;
    saving.onSaveNew(naming.trim());
    setNaming(null);
  };
  const [beat, setBeat] = useState<number | null>(null);
  const bar = tune.bar ?? 8;
  const bpm = Math.round(30000 / tune.eighthMs);
  const bad = [...readNotes(tune.melody).bad, ...readNotes(tune.low).bad];
  const fieldStyle = { font: "inherit", fontSize: 14, color: INK, padding: 8, borderRadius: 8, border: `1.5px solid ${BINDING}`, background: "rgba(255,255,255,.6)" };

  useEffect(() => {
    if (!playing) return;
    watchBeat(setBeat);
    return () => {
      watchBeat(null);
      setBeat(null);
    };
  }, [playing]);

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 14, padding: 12, borderRadius: 12, background: playing ? "rgba(246,196,69,.18)" : "rgba(123,59,46,.05)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Btn small primary={playing} onClick={onToggle} label={playing ? "Stop my tune" : "Play my tune"}>
          {playing ? "■" : "▶"}
        </Btn>
        <div style={{ fontWeight: 600, fontSize: 17 }}>Make your own</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          Speed
          <input type="range" min={40} max={120} step={1} value={bpm} onChange={(e) => onChange({ ...tune, eighthMs: 30000 / Number(e.target.value) })} style={{ accentColor: BINDING }} />
          <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 120 }}>{bpm} quarter notes a minute</span>
        </label>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          Beats in a bar
          {[4, 3].map((n) => (
            <Btn key={n} small tight primary={bar === n * 2} onClick={() => onChange({ ...tune, bar: n * 2 })} label={`${n} beats in a bar`}>
              {n}
            </Btn>
          ))}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 }}>
        <span style={{ opacity: 0.8 }}>
          {saving.sourceName ? (
            <>
              Editing <b>{saving.sourceName}</b>
              {saving.dirty ? ", not saved yet" : ", saved"}
            </>
          ) : (
            "Not saved as a track yet"
          )}
        </span>
        {saving.sourceName && (
          <Btn small tight primary={saving.dirty} disabled={!saving.dirty} onClick={saving.onSave}>
            Save over {saving.sourceName}
          </Btn>
        )}
        {naming === null ? (
          <Btn small tight onClick={() => setNaming(saving.nextName)}>
            Save as a new track
          </Btn>
        ) : (
          <form
            style={{ display: "flex", gap: 6, alignItems: "center" }}
            onSubmit={(e) => {
              e.preventDefault();
              saveNew();
            }}
          >
            <input aria-label="New track name" autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} style={{ ...fieldStyle, padding: "5px 8px" }} />
            <button type="submit" style={{ display: "none" }} />
            <Btn small tight primary disabled={!naming.trim()} onClick={saveNew}>
              Save
            </Btn>
            <Btn small tight onClick={() => setNaming(null)}>
              Cancel
            </Btn>
          </form>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 14 }}>
        Sound
        {VOICES.map(([id, name]) => (
          <Btn key={id} small tight primary={voice === id} onClick={() => onChange({ ...tune, voice: id })}>
            {name}
          </Btn>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 14 }}>
        New notes are
        {BRUSHES.map(([name, len]) => (
          <Btn key={name} small tight primary={brush === len} onClick={() => setBrush(len)}>
            {name}
          </Btn>
        ))}
      </div>
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Click the grid to add a note and drag right to stretch it. Drag a note to move it, drag its right edge to change its
        length, and click it to take it off. Click a key on the left to hear it. One note sounds at a time in each part, and
        changes play straight away.
      </div>
      <PianoRoll label="Tune" text={tune.melody} onChange={(melody) => onChange({ ...tune, melody })} low={false} bar={bar} brush={brush} beat={beat} voice={voice} />
      <PianoRoll label="Low notes" text={tune.low} onChange={(low) => onChange({ ...tune, low })} low bar={bar} brush={Math.max(brush, 4)} beat={beat} voice={voice} />
      <details>
        <summary style={{ cursor: "pointer", fontSize: 14 }}>As text, to copy or paste</summary>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Each note is a name and a length in eighth notes: G5:1 is an eighth, G5:2 a quarter, G5:4 a half and G5:8 a whole bar.
            _:2 rests for a quarter. Sharps and flats like F#5 or Bb4 work too.
          </div>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Tune
            <textarea rows={3} value={tune.melody} onChange={(e) => onChange({ ...tune, melody: e.target.value })} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Low notes
            <input value={tune.low} onChange={(e) => onChange({ ...tune, low: e.target.value })} style={fieldStyle} />
          </label>
          {bad.length > 0 && <div style={{ fontSize: 13, color: BINDING }}>Skipped, not a note: {bad.join(", ")}</div>}
        </div>
      </details>
    </div>
  );
}
