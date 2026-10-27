"use client";

// Sound lab: every moment in a game of Snug with its sound choices side by side. Play them, pick one per
// moment, hear them together in a pretend turn, and copy the picks to send back.

import { useEffect, useState } from "react";
import { BINDING } from "./quilt";
import { Btn, FONT, INK, PanelStitches, QuiltBackdrop, SCRIPT, panelStyle } from "./parts";
import { SNUG_FONTS } from "./fonts";
import { DEFAULT_PICKS, MOMENTS, TRACKS, playTune, playTurn, retune, setGameSounds, setVolumes, stopMusic, type Track, type Tune } from "./sounds";
import { TuneEditor } from "./TuneEditor";
import { SnugPlayground } from "./Snug";

const PICKS_KEY = "snug.soundPicks.v2";
const TUNE_KEY = "snug.tuneDraft";
const SOURCE_KEY = "snug.tuneSource";
const LIBRARY_KEY = "snug.tuneLibrary";
/** The track id while the editor's own tune plays. */
const MINE = "mine";

/** Saved edits over the built-in tracks, and tracks of your own; this browser only. */
type Library = { edits: Record<string, Tune>; mine: Track[] };

const isTune = (t: unknown): t is Tune => {
  const u = t as Partial<Tune> | null;
  return !!u && typeof u.melody === "string" && typeof u.low === "string" && typeof u.eighthMs === "number" && u.eighthMs > 0;
};
const sameTune = (a: Tune, b: Tune) =>
  a.melody.trim() === b.melody.trim() &&
  a.low.trim() === b.low.trim() &&
  Math.round(a.eighthMs) === Math.round(b.eighthMs) &&
  (a.bar ?? 8) === (b.bar ?? 8) &&
  (a.voice ?? "musicbox") === (b.voice ?? "musicbox");

function read<T>(key: string, ok: (v: unknown) => v is T): T | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return ok(v) ? v : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the change still lasts while the page is open.
  }
}
const isLibrary = (v: unknown): v is Library => {
  const l = v as Partial<Library> | null;
  return !!l && typeof l.edits === "object" && l.edits !== null && Array.isArray(l.mine);
};
const isSource = (v: unknown): v is string => typeof v === "string";

function loadPicks(): Record<string, string> {
  const first = { ...Object.fromEntries(MOMENTS.map((m) => [m.id, m.variants[0]!.id])), ...DEFAULT_PICKS };
  try {
    return { ...first, ...(JSON.parse(localStorage.getItem(PICKS_KEY) ?? "{}") as Record<string, string>) };
  } catch {
    return first;
  }
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      {label}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ accentColor: BINDING }}
      />
      <span style={{ width: 34, fontVariantNumeric: "tabular-nums" }}>{Math.round(value * 100)}%</span>
    </label>
  );
}

export function SoundLab() {
  const [picks, setPicks] = useState<Record<string, string>>(loadPicks);
  const [fxVol, setFxVol] = useState(0.7);
  const [musicVol, setMusicVol] = useState(0.35);
  const [track, setTrack] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [draft, setDraft] = useState<Tune>(() => read(TUNE_KEY, isTune) ?? TRACKS[0]!.tune);
  /** The track the editor's tune was loaded from, which Save writes over. */
  const [source, setSource] = useState<string | null>(() => (read(TUNE_KEY, isTune) ? read(SOURCE_KEY, isSource) : TRACKS[0]!.id));
  const [library, setLibrary] = useState<Library>(() => read(LIBRARY_KEY, isLibrary) ?? { edits: {}, mine: [] });
  const tracks: (Track & { edited?: boolean; own?: boolean })[] = [
    ...TRACKS.map((t) => (library.edits[t.id] ? { ...t, tune: library.edits[t.id]!, edited: true } : t)),
    ...library.mine.map((t) => ({ ...t, own: true })),
  ];
  const sourceTrack = tracks.find((t) => t.id === source) ?? null;
  const dirty = !sourceTrack || !sameTune(sourceTrack.tune, draft);

  const [quickHelp, setQuickHelp] = useState(true);
  const [round, setRound] = useState(0);

  useEffect(() => () => stopMusic(), []);
  // The test quilt below plays the picked sounds; leaving the lab turns game sounds off again.
  useEffect(() => {
    setGameSounds(picks);
    return () => setGameSounds(null);
  }, [picks]);

  const choose = (moment: string, variant: string) => {
    const next = { ...picks, [moment]: variant };
    setPicks(next);
    try {
      localStorage.setItem(PICKS_KEY, JSON.stringify(next));
    } catch {
      // Storage can be blocked; the picks still last while the page is open.
    }
  };
  const volumes = (fx: number, music: number) => {
    setFxVol(fx);
    setMusicVol(music);
    setVolumes(fx, music);
  };
  const toggleTrack = (t: Track) => {
    if (track === t.id) {
      stopMusic();
      setTrack(null);
    } else {
      setVolumes(fxVol, musicVol);
      playTune(t.tune);
      setTrack(t.id);
    }
  };
  const editTune = (next: Tune) => {
    setDraft(next);
    write(TUNE_KEY, next);
    if (track === MINE) retune(next);
  };
  const pointAt = (id: string | null) => {
    setSource(id);
    write(SOURCE_KEY, id);
  };
  const saveLibrary = (next: Library) => {
    setLibrary(next);
    write(LIBRARY_KEY, next);
  };
  /** Loads a track into the editor, checking first when that would lose unsaved changes. */
  const loadTrack = (t: Track) => {
    if (dirty && !sameTune(t.tune, draft) && !window.confirm("Replace the tune in the editor? Its changes are not saved.")) return;
    editTune(t.tune);
    pointAt(t.id);
  };
  const saveOver = () => {
    if (!sourceTrack) return;
    if (sourceTrack.own) saveLibrary({ ...library, mine: library.mine.map((t) => (t.id === sourceTrack.id ? { ...t, tune: draft } : t)) });
    else saveLibrary({ ...library, edits: { ...library.edits, [sourceTrack.id]: draft } });
    if (track === sourceTrack.id) retune(draft);
  };
  const saveNew = (name: string) => {
    const id = `mine-${Date.now()}`;
    saveLibrary({ ...library, mine: [...library.mine, { id, name, feel: "Your own tune, saved in this browser.", tune: draft }] });
    pointAt(id);
  };
  const undoEdits = (t: Track) => {
    if (!window.confirm(`Put ${t.name} back the way it came? Your saved changes to it go away.`)) return;
    const { [t.id]: _gone, ...edits } = library.edits;
    saveLibrary({ ...library, edits });
    const original = TRACKS.find((o) => o.id === t.id)!.tune;
    if (track === t.id) retune(original);
  };
  const remove = (t: Track) => {
    if (!window.confirm(`Delete ${t.name}?`)) return;
    saveLibrary({ ...library, mine: library.mine.filter((o) => o.id !== t.id) });
    if (track === t.id) {
      stopMusic();
      setTrack(null);
    }
    if (source === t.id) pointAt(null);
  };
  const toggleMine = () => {
    if (track === MINE) {
      stopMusic();
      setTrack(null);
    } else {
      setVolumes(fxVol, musicVol);
      playTune(draft);
      setTrack(MINE);
    }
  };
  const copyPicks = async () => {
    const lines = MOMENTS.map((m) => `${m.name}: ${m.variants.find((v) => v.id === picks[m.id])?.name ?? "?"}`);
    const describe = (name: string, t: Tune) => [
      `${name}: ${t.melody}`,
      `Low notes: ${t.low}`,
      `Speed: ${Math.round(30000 / t.eighthMs)} quarter notes a minute, ${(t.bar ?? 8) / 2} beats in a bar, ${t.voice ?? "musicbox"}`,
    ];
    const playing = tracks.find((t) => t.id === track);
    const music = track === MINE ? "the editor's tune" : (playing?.name ?? "none");
    const saved = tracks.filter((t) => t.edited || t.own).flatMap((t) => describe(t.name, t.tune));
    await navigator.clipboard.writeText([...lines, `Music: ${music}`, ...saved, ...describe("In the editor", draft)].join("\n")).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={SNUG_FONTS} style={{ fontFamily: FONT, color: INK, display: "grid", gap: 24 }}>
      <QuiltBackdrop dateKey="2026-09-15" />
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="sound-head" />
        <h1 style={{ fontFamily: SCRIPT, fontSize: 44, margin: 0, color: BINDING }}>Sound lab</h1>
        <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 14px", maxWidth: 720 }}>
          Every sound is made in the browser, so nothing is downloaded or licensed. Play each choice, pick one per moment, then
          hear your picks together in a pretend turn. Copy your picks to send them back.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <Slider label="Effects" value={fxVol} onChange={(v) => volumes(v, musicVol)} />
          <Slider label="Music" value={musicVol} onChange={(v) => volumes(fxVol, v)} />
          <span style={{ flex: 1 }} />
          <Btn
            primary
            onClick={() => {
              setVolumes(fxVol, musicVol);
              playTurn(picks);
            }}
          >
            Play a turn
          </Btn>
          <Btn onClick={copyPicks}>{copied ? "Copied" : "Copy my picks"}</Btn>
        </div>
      </section>

      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="sound-music" />
        <h2 style={{ fontFamily: SCRIPT, fontSize: 32, margin: "0 0 4px", color: BINDING }}>Music</h2>
        <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 12px" }}>
          Background loops, quiet under the effects. Off by default in the game. The same music-box tune with different rhythms.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {tracks.map((t) => (
            <div key={t.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 12, background: track === t.id ? "rgba(246,196,69,.18)" : "rgba(123,59,46,.05)", border: `1.5px dashed ${source === t.id ? BINDING : "transparent"}` }}>
              <Btn small onClick={() => toggleTrack(t)} label={track === t.id ? `Stop ${t.name}` : `Play ${t.name}`}>
                {track === t.id ? "■" : "▶"}
              </Btn>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {t.name}
                  {t.edited && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: "rgba(246,196,69,.45)" }}>your edit</span>}
                </div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>{t.feel}</div>
              </div>
              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                <Btn small tight onClick={() => loadTrack(t)} label={`Edit ${t.name}`}>
                  Edit
                </Btn>
                {t.edited && (
                  <Btn small tight onClick={() => undoEdits(t)} label={`Undo my edits to ${t.name}`}>
                    Undo edits
                  </Btn>
                )}
                {t.own && (
                  <Btn small tight onClick={() => remove(t)} label={`Delete ${t.name}`}>
                    Delete
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
        <TuneEditor
          tune={draft}
          onChange={editTune}
          playing={track === MINE}
          onToggle={toggleMine}
          saving={{ sourceName: sourceTrack?.name ?? null, dirty, onSave: saveOver, onSaveNew: saveNew, nextName: `My tune ${library.mine.length + 1}` }}
        />
      </section>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {MOMENTS.map((m) => (
          <section key={m.id} style={{ ...panelStyle, width: "100%" }} aria-label={m.name}>
            <PanelStitches seed={`sound-${m.id}`} />
            <h2 style={{ fontFamily: SCRIPT, fontSize: 30, margin: 0, color: BINDING }}>{m.name}</h2>
            <p style={{ fontSize: 13, opacity: 0.75, margin: "2px 0 10px" }}>{m.when}</p>
            <div style={{ display: "grid", gap: 6 }}>
              {m.variants.map((v) => {
                const chosen = picks[m.id] === v.id;
                return (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "6px 8px",
                      borderRadius: 10,
                      background: chosen ? "rgba(246,196,69,.2)" : "transparent",
                      border: `1.5px dashed ${chosen ? BINDING : "transparent"}`,
                    }}
                  >
                    <Btn
                      small
                      tight
                      onClick={() => {
                        setVolumes(fxVol, musicVol);
                        v.play();
                      }}
                      label={`Play ${v.name}`}
                    >
                      ▶
                    </Btn>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{v.name}</div>
                      <div style={{ fontSize: 13, opacity: 0.75 }}>{v.feel}</div>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                      <input type="radio" name={`pick-${m.id}`} checked={chosen} onChange={() => choose(m.id, v.id)} style={{ accentColor: BINDING }} />
                      Pick
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="sound-play" />
        <h2 style={{ fontFamily: SCRIPT, fontSize: 32, margin: "0 0 4px", color: BINDING }}>Try them in a game</h2>
        <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 12px" }}>
          A real Snug board with your picks. Nothing is saved. With help right away, the spare and unlimited hints unlock at
          once, so you can hint your way to the end and hear the finish.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Btn primary onClick={() => setRound((n) => n + 1)}>
            Reset the quilt
          </Btn>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={quickHelp}
              onChange={(e) => {
                setQuickHelp(e.target.checked);
                setRound((n) => n + 1);
              }}
              style={{ accentColor: BINDING }}
            />
            Help right away (spare and hints)
          </label>
        </div>
      </section>
      <SnugPlayground key={`${round}-${quickHelp}`} quickHelp={quickHelp} />
    </div>
  );
}
