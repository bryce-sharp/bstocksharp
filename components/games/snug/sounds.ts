// Snug's sounds, synthesized with the browser's Web Audio: no files to load or license. Everything is soft
// and short, through one gentle room so the pieces sit together. The lab (/games/snug/lab/sounds) plays
// every variant; the game will use the picked ones.

type Ctx = { ac: AudioContext; fx: GainNode; music: GainNode; room: ConvolverNode };
let shared: Ctx | null = null;

/** The audio graph, made on the first sound (browsers only allow audio after a tap). */
export function audio(): Ctx {
  if (shared) {
    if (shared.ac.state === "suspended") void shared.ac.resume();
    return shared;
  }
  const ac = new AudioContext();
  const out = ac.createDynamicsCompressor();
  out.threshold.value = -18;
  out.ratio.value = 3;
  out.connect(ac.destination);
  // A small, warm room: decaying noise as the impulse.
  const room = ac.createConvolver();
  const len = Math.floor(ac.sampleRate * 1.6);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  room.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.22;
  room.connect(wet).connect(out);
  const fx = ac.createGain();
  fx.gain.value = 0.7;
  fx.connect(out);
  fx.connect(room);
  const music = ac.createGain();
  music.gain.value = 0.35;
  music.connect(out);
  music.connect(room);
  shared = { ac, fx, music, room };
  return shared;
}

export function setVolumes(fx: number, music: number) {
  const { fx: f, music: m, ac } = audio();
  f.gain.setTargetAtTime(fx, ac.currentTime, 0.05);
  m.gain.setTargetAtTime(music, ac.currentTime, 0.05);
}

// ── Building blocks ──────────────────────────────────────────────────────────

type Tone = {
  freq: number;
  to?: number; // glide to this pitch
  type?: OscillatorType;
  at?: number; // seconds from now
  attack?: number;
  decay?: number;
  gain?: number;
  lowpass?: number;
  out?: AudioNode;
};

function tone({ freq, to, type = "sine", at = 0, attack = 0.005, decay = 0.3, gain = 0.3, lowpass, out }: Tone) {
  const { ac, fx } = audio();
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay * 0.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  let node: AudioNode = o.connect(g);
  if (lowpass) {
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    node = node.connect(f);
  }
  node.connect(out ?? fx);
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

/** A bell or music-box note: a few inharmonic partials that fade at different rates. */
function bell(freq: number, at = 0, gain = 0.18, decay = 1.2, out?: AudioNode) {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.35, 0.55],
    [5.4, 0.12, 0.3],
  ];
  for (const [ratio, level, life] of partials) tone({ freq: freq * ratio, at, decay: decay * life, gain: gain * level, out });
}

/** A kalimba-ish pluck: a sine with a quick bright tick on top. */
function kalimba(freq: number, at = 0, gain = 0.22, out?: AudioNode) {
  tone({ freq, at, decay: 0.9, gain, out });
  tone({ freq: freq * 3.01, at, decay: 0.08, gain: gain * 0.25, out });
}

/** A short burst of filtered noise: cloth, paper, breath. */
function noise({
  at = 0,
  dur = 0.15,
  attack = 0.02,
  gain = 0.2,
  type = "bandpass",
  freq = 1200,
  to,
  q = 0.8,
  out,
}: { at?: number; dur?: number; attack?: number; gain?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; out?: AudioNode }) {
  const { ac, fx } = audio();
  const t = ac.currentTime + at;
  const len = Math.max(1, Math.floor(ac.sampleRate * (dur + 0.05)));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  // Pinkish noise (a gentle low-pass on white) sounds softer than plain hiss.
  for (let i = 0; i < len; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
    d[i] = last;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out ?? fx);
  src.start(t);
  src.stop(t + dur + 0.05);
}

// A warm pentatonic scale (C major pentatonic, middle register), so random notes always sound kind.
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
let step = 0;
/** Walks up the scale a little each call, so repeated placements make a tune rather than noise. */
const nextNote = () => PENTA[(step = (step + 1 + Math.floor(Math.random() * 2)) % 7) + 2]!;

// ── Every moment and its variants ────────────────────────────────────────────

export type Variant = { id: string; name: string; feel: string; play: () => void };
export type Moment = { id: string; name: string; when: string; variants: Variant[] };

const silent: Variant = { id: "none", name: "Silence", feel: "No sound for this moment.", play: () => {} };

// The game asks for sounds by moment; nothing plays until something turns them on (the lab, for now).
let gamePicks: Record<string, string> | null = null;

const sweep = (from: number, to: number, down: boolean) => (down ? { freq: to, to: from } : { freq: from, to });

/** Pick-up sounds; played `down`, each sweeps the other way, so stitching down mirrors the lift. */
const LIFTS: (Omit<Variant, "play"> & { play: (down: boolean) => void })[] = [
  { id: "cloth", name: "Cloth lift", feel: "The original: a soft fabric rustle as it leaves the basket.", play: (down) => noise({ dur: 0.16, ...sweep(1400, 2600, down), gain: 0.12, q: 0.7 }) },
  { id: "softcloth", name: "Softer cloth", feel: "The same rustle, quieter, slower to start and a little lower.", play: (down) => noise({ dur: 0.2, attack: 0.04, ...sweep(1000, 1800, down), gain: 0.07, q: 0.7 }) },
  { id: "cotton", name: "Cotton", feel: "A muffled, rounder rustle, like lifting a cotton square.", play: (down) => noise({ dur: 0.16, attack: 0.03, type: "lowpass", ...sweep(1600, 2200, down), gain: 0.09 }) },
  { id: "wool", name: "Wool", feel: "Lower and fuzzier, like a knitted patch.", play: (down) => noise({ dur: 0.18, attack: 0.03, ...sweep(650, 1100, down), gain: 0.1, q: 0.6 }) },
  { id: "silk", name: "Silk", feel: "Barely there: a light, airy slip of silk.", play: (down) => noise({ dur: 0.24, attack: 0.06, ...sweep(2400, 3400, down), gain: 0.045, q: 1.2 }) },
  { id: "felt", name: "Felt pop", feel: "A low, round pop, like lifting felt.", play: (down) => tone({ ...sweep(300, 430, down), decay: 0.12, gain: 0.18 }) },
];

export const MOMENTS: Moment[] = [
  {
    id: "pickup",
    name: "Pick up a patch",
    when: "You press on a patch in the basket or on the quilt.",
    variants: [...LIFTS.map((l) => ({ ...l, play: () => l.play(false) })), silent],
  },
  {
    id: "place",
    name: "Stitch a patch down",
    when: "A patch lands on the quilt where it fits.",
    variants: [
      {
        id: "mirror",
        name: "Pick-up in reverse",
        feel: "Whichever pick-up sound you chose, swept the other way as the patch settles.",
        play: () => LIFTS.find((l) => l.id === (gamePicks ?? DEFAULT_PICKS).pickup)?.play(true),
      },
      { id: "thunk", name: "Soft thunk", feel: "A cozy low thud, like a patch settling into a pillow.", play: () => { tone({ freq: 190, to: 95, decay: 0.18, gain: 0.32 }); noise({ dur: 0.06, freq: 700, gain: 0.06 }); } },
      silent,
    ],
  },
  {
    id: "nofit",
    name: "It does not fit",
    when: "You drop a patch where it cannot go and it slides back.",
    variants: [
      { id: "bump", name: "Muted bump", feel: "A gentle, low nudge. Never a buzzer.", play: () => tone({ freq: 150, to: 115, decay: 0.14, gain: 0.25, lowpass: 600 }) },
      { id: "wobble", name: "Soft wobble", feel: "Two low notes stepping down: \"not quite\".", play: () => { tone({ freq: 220, decay: 0.12, gain: 0.15, type: "triangle", lowpass: 900 }); tone({ freq: 196, at: 0.1, decay: 0.16, gain: 0.13, type: "triangle", lowpass: 900 }); } },
      { id: "puff", name: "Cloth puff", feel: "A muffled puff of fabric.", play: () => noise({ dur: 0.18, type: "lowpass", freq: 600, gain: 0.16 }) },
      silent,
    ],
  },
  {
    id: "turn",
    name: "Rotate or flip",
    when: "You turn or flip the patch in your hand.",
    variants: [
      { id: "tick", name: "Wood tick", feel: "A tiny wooden tick.", play: () => tone({ freq: 1200, to: 900, decay: 0.04, gain: 0.08 }) },
      { id: "swish", name: "Swish", feel: "A short fabric swish.", play: () => noise({ dur: 0.1, freq: 2000, to: 3500, q: 1.5, gain: 0.07 }) },
      { id: "pluck", name: "Little pluck", feel: "One very quiet kalimba note.", play: () => kalimba(784, 0, 0.07) },
      silent,
    ],
  },
  {
    id: "undo",
    name: "Undo or empty",
    when: "Undo, or Empty the quilt.",
    variants: [
      { id: "unpick", name: "Thread unpick", feel: "Three tiny soft ticks stepping down, like unpicking stitches.", play: () => [0, 0.06, 0.12].forEach((at, i) => tone({ freq: 1500 - i * 220, at, decay: 0.03, gain: 0.045 })) },
      { id: "rewind", name: "Soft rewind", feel: "One quiet kalimba note sliding gently down.", play: () => tone({ freq: 659.25, to: 493.88, decay: 0.35, gain: 0.08 }) },
      { id: "foldback", name: "Fold back", feel: "A low fabric fold with a soft hum under it.", play: () => { noise({ dur: 0.2, attack: 0.05, type: "lowpass", freq: 900, gain: 0.09 }); tone({ freq: 196, attack: 0.04, decay: 0.25, gain: 0.06, lowpass: 500 }); } },
      { id: "popback", name: "Pop back", feel: "The felt pop in reverse: a round little drop.", play: () => tone({ freq: 430, to: 290, decay: 0.12, gain: 0.14 }) },
      silent,
    ],
  },
  {
    id: "unlock",
    name: "A help unlocks",
    when: "The spare at 3:00, a hint at 5:00 and 10:00 (with the gold rings).",
    variants: [
      { id: "twinkle", name: "Music-box twinkle", feel: "Three music-box notes rising, like a tiny wind-up box.", play: () => { bell(783.99, 0, 0.12); bell(987.77, 0.12, 0.11); bell(1174.66, 0.24, 0.12, 1.6); } },
      { id: "chime", name: "Warm chime", feel: "One rounded chime, soft and low.", play: () => bell(523.25, 0, 0.16, 1.8) },
      { id: "shimmer", name: "Gold shimmer", feel: "A chime with a little sparkle of thread around it.", play: () => { bell(659.25, 0, 0.12, 1.4); noise({ dur: 0.5, attack: 0.15, type: "highpass", freq: 6000, gain: 0.03 }); } },
      { id: "kalimba2", name: "Kalimba hello", feel: "Two kalimba notes, a friendly \"oh, hello\".", play: () => { kalimba(587.33, 0, 0.14); kalimba(783.99, 0.14, 0.14); } },
    ],
  },
  {
    id: "spare",
    name: "Tag the spare",
    when: "You tap Spare and the paper tag swings on.",
    variants: [
      { id: "flutter", name: "Paper flutter", feel: "A paper tag fluttering into place.", play: () => { for (let i = 0; i < 4; i++) noise({ at: i * 0.05, dur: 0.05, freq: 2600 - i * 300, q: 2, gain: 0.05 }); } },
      { id: "pin", name: "Pin + chime", feel: "A tiny pin tick, then a soft low chime.", play: () => { tone({ freq: 2600, decay: 0.03, gain: 0.07 }); bell(392, 0.08, 0.1, 1.2); } },
      { id: "settle", name: "Settle down", feel: "A gentle downward pair as it greys.", play: () => { bell(659.25, 0, 0.08, 0.9); bell(523.25, 0.18, 0.08, 1.2); } },
      silent,
    ],
  },
  {
    id: "hint",
    name: "A hint stitches in",
    when: "A hint stitches a patch into place in gold thread.",
    variants: [
      { id: "sweep", name: "Gold sweep", feel: "Quick rising music-box notes, like gold thread running.", play: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, i * 0.06, 0.08, 1)) },
      { id: "harp", name: "Harp run", feel: "A soft harp-like run up the scale.", play: () => PENTA.slice(2, 8).forEach((f, i) => kalimba(f, i * 0.045, 0.08)) },
      { id: "single", name: "One gold note", feel: "A single bright, quiet note.", play: () => bell(1046.5, 0, 0.1, 1.4) },
    ],
  },
  {
    id: "tie",
    name: "Tie it off with holes",
    when: "You finish with holes left.",
    variants: [
      { id: "settle", name: "Gentle settle", feel: "Three soft notes coming to rest: done, no fuss.", play: () => [659.25, 587.33, 523.25].forEach((f, i) => kalimba(f, i * 0.14, 0.12)) },
      { id: "chord", name: "Warm chord", feel: "One soft chord, content rather than triumphant.", play: () => [261.63, 329.63, 392].forEach((f) => tone({ freq: f, attack: 0.08, decay: 1.4, gain: 0.08, type: "triangle", lowpass: 1500 })) },
    ],
  },
  {
    id: "snug",
    name: "Perfectly snug",
    when: "You fill every hole: the best moment.",
    variants: [
      { id: "musicbox", name: "Music-box melody", feel: "A short wind-up music-box tune.", play: () => [523.25, 659.25, 783.99, 659.25, 880, 1046.5].forEach((f, i) => bell(f, i * 0.16, 0.12, i === 5 ? 2.2 : 1)) },
      { id: "bloom", name: "Warm bloom", feel: "A big soft major chord that swells and glows.", play: () => [130.81, 261.63, 329.63, 392, 523.25].forEach((f, i) => tone({ freq: f, attack: 0.25, decay: 2.6, gain: i === 0 ? 0.1 : 0.07, type: "triangle", lowpass: 1800 })) },
      { id: "cascade", name: "Kalimba cascade", feel: "Kalimba notes tumbling up, then a bell.", play: () => { PENTA.forEach((f, i) => kalimba(f, i * 0.07, 0.1)); bell(1046.5, PENTA.length * 0.07, 0.12, 2); } },
      { id: "harpbell", name: "Harp + bells", feel: "A harp run up into two ringing bells.", play: () => { PENTA.slice(0, 8).forEach((f, i) => kalimba(f, i * 0.05, 0.09)); bell(783.99, 0.45, 0.12, 2); bell(1046.5, 0.6, 0.11, 2.4); } },
    ],
  },
  {
    id: "tap",
    name: "Button taps",
    when: "How to play, Keep going, View result and the other buttons without a sound of their own.",
    variants: [
      { id: "felt", name: "Felt tap", feel: "A very soft, low tap.", play: () => tone({ freq: 420, to: 300, decay: 0.05, gain: 0.08 }) },
      { id: "tick", name: "Tiny tick", feel: "A tiny, high wooden tick.", play: () => tone({ freq: 1500, decay: 0.025, gain: 0.05 }) },
      silent,
    ],
  },
  {
    id: "pause",
    name: "Pause and resume",
    when: "The quilt covers over, and uncovers again.",
    variants: [
      { id: "fold", name: "Fold and unfold", feel: "A fabric fold, a soft note down (pause) or up (resume).", play: () => { noise({ dur: 0.25, attack: 0.08, freq: 900, gain: 0.08 }); kalimba(392, 0.12, 0.08); } },
      { id: "breath", name: "Breath", feel: "A slow, quiet breath of air.", play: () => noise({ dur: 0.5, attack: 0.2, type: "lowpass", freq: 1200, gain: 0.07 }) },
      silent,
    ],
  },
];

// ── Music: music-box tunes written as text, all made in code ─────────────────

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "G5" or "F#4" or "Bb4" as a MIDI number; null when it is not a note. */
function noteMidi(name: string): number | null {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + SEMITONES[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
export const midiName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const midiFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A note `len` eighths long, starting `start` eighths into the tune. */
export type Note = { midi: number; start: number; len: number };

/**
 * A tune as text: each note is a name and a length in eighth notes, so "G5:2" is a quarter, "G5:1" an eighth and
 * "G5:4" a half; "_:2" rests a quarter. `steps` is the tune's length in eighths; `bad` lists what did not read as a note.
 */
export function readNotes(text: string) {
  const notes: Note[] = [];
  const bad: string[] = [];
  let at = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const [name = "", len = "2"] = word.split(":");
    const eighths = Math.round(Number(len));
    const midi = name === "_" ? null : noteMidi(name);
    if ((midi === null && name !== "_") || !(eighths >= 1 && eighths <= 32)) {
      bad.push(word);
      continue;
    }
    if (midi !== null) notes.push({ midi, start: at, len: eighths });
    at += eighths;
  }
  return { notes, steps: at, bad };
}

/** Notes back to text, resting through the gaps, `steps` eighths long in all. */
export function writeNotes(notes: Note[], steps: number) {
  const words: string[] = [];
  const rest = (n: number) => {
    for (; n > 0; n -= 32) words.push(`_:${Math.min(32, n)}`);
  };
  let at = 0;
  for (const n of [...notes].sort((a, b) => a.start - b.start)) {
    rest(n.start - at);
    words.push(`${midiName(n.midi)}:${n.len}`);
    at = n.start + n.len;
  }
  rest(steps - at);
  return words.join(" ");
}

export type Voice = "musicbox" | "bright" | "kalimba";
export const VOICES: [Voice, string][] = [
  ["musicbox", "Music box"],
  ["bright", "Bright bells"],
  ["kalimba", "Kalimba"],
];

/** A brighter bell: more of the high partials, and a quick sparkle an octave up. */
function brightBell(freq: number, decay: number, out: AudioNode) {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.76, 0.6, 0.5],
    [5.4, 0.35, 0.3],
    [8.93, 0.15, 0.15],
  ];
  for (const [ratio, level, life] of partials) tone({ freq: freq * ratio, decay: decay * life, gain: 0.06 * level, out });
  tone({ freq: freq * 2, decay: 0.12, gain: 0.03, out });
}

/** One melody note in a voice; longer notes ring longer. */
function sing(voice: Voice, midi: number, len: number, out: AudioNode) {
  const freq = midiFreq(midi);
  if (voice === "kalimba") kalimba(freq, 0, 0.09, out);
  else if (voice === "bright") brightBell(freq, 1 + len * 0.15, out);
  else bell(freq, 0, 0.07, 1.2 + len * 0.2, out);
}

/** `melody` rings in `voice` (the music box unless set) over the soft hum of `low`; `eighthMs` sets the speed and `bar` the eighths in a bar. */
export type Tune = { melody: string; low: string; eighthMs: number; bar?: number; voice?: Voice };
export type Track = { id: string; name: string; feel: string; tune: Tune };

export const TRACKS: Track[] = [
  {
    id: "musicbox",
    name: "1. The original",
    feel: "The first music-box lullaby, as it was: every note a quarter note.",
    tune: { melody: "G5:2 E5:2 C5:2 E5:2 D5:2 C5:2 A4:2 C5:2 E5:2 D5:2 C5:2 G4:2 A4:2 C5:2 D5:2 _:2", low: "C3:16 A2:16 F2:16 G2:16", eighthMs: 410 },
  },
  {
    id: "lilt",
    name: "2. Long and short",
    feel: "The same notes with a lilt: a long note leaning into a short one, and a held note at the end of each line.",
    tune: { melody: "G5:3 E5:1 C5:2 E5:2 D5:3 C5:1 A4:4 C5:2 E5:2 D5:3 C5:1 G4:4 A4:2 C5:2 D5:4", low: "C3:8 A2:8 F2:8 G2:8", eighthMs: 400 },
  },
  {
    id: "bright",
    name: "3. Bright bells",
    feel: "Higher and quicker on glassy bells that sparkle, with a skip of eighth notes in every bar.",
    tune: {
      melody: "C6:1 D6:1 E6:2 G5:2 A5:1 C6:1 D6:4 E6:1 D6:1 C6:2 A5:2 G5:1 A5:1 C6:4 E6:2 D6:2 C6:2 _:2",
      low: "C3:8 G2:8 A2:8 F2:4 G2:4",
      eighthMs: 340,
      voice: "bright",
    },
  },
  {
    id: "runs",
    name: "4. Little runs",
    feel: "Quick runs of eighth notes that land on a long note, like a box being wound.",
    tune: { melody: "G5:1 A5:1 G5:1 E5:1 C5:4 E5:1 D5:1 C5:1 A4:1 C5:4 E5:1 G5:1 E5:1 D5:1 C5:2 G4:2 A4:2 C5:2 D5:4", low: "C3:8 A2:8 C3:8 G2:8", eighthMs: 380 },
  },
  {
    id: "rainy",
    name: "5. Rainy window",
    feel: "Something different: a minor kalimba tune with notes off the beat, over a low line that bounces.",
    tune: {
      melody: "A4:1 _:1 C5:1 E5:2 D5:1 C5:2 A4:1 _:1 C5:1 D5:2 E5:1 G5:2 E5:3 D5:1 C5:2 A4:2 G4:2 A4:6",
      low: "A2:2 E3:2 A2:2 E3:2 F2:2 C3:2 F2:2 C3:2 C3:2 G2:2 C3:2 G2:2 E3:2 B2:2 A2:4",
      eighthMs: 330,
      voice: "kalimba",
    },
  },
  {
    id: "three",
    name: "6. In three",
    feel: "The tune as a slow waltz: long then short, one-two-three.",
    tune: { melody: "G5:4 E5:2 C5:4 E5:2 D5:4 C5:2 A4:6 E5:4 D5:2 C5:4 G4:2 A4:2 C5:2 D5:2 C5:6", low: "C3:12 G2:6 A2:6 C3:6 C3:6 F2:6 C3:6", eighthMs: 330, bar: 6 },
  },
];

let musicTimer = 0;
let musicNodes: AudioNode[] = [];
type Live = { melody: (Note | null)[]; low: (Note | null)[]; eighthMs: number; voice: Voice; bus: GainNode };
let live: Live | null = null;
let beat = 0;
let beatWatcher: ((beat: number) => void) | null = null;

/** Calls `watch` with each eighth as it plays, counting from the start of the loop. */
export function watchBeat(watch: ((beat: number) => void) | null) {
  beatWatcher = watch;
}

/** The note starting on each eighth, or null. */
function byStep(text: string) {
  const { notes, steps } = readNotes(text);
  const out = Array<Note | null>(steps).fill(null);
  for (const n of notes) out[n.start] = n;
  return out;
}

function tick() {
  if (!live) return;
  const { melody, low, eighthMs, voice, bus } = live;
  const note = melody.length ? melody[beat % melody.length] : null;
  if (note) sing(voice, note.midi, note.len, bus);
  const under = low.length ? low[beat % low.length] : null;
  // Short low notes start quicker, so a bouncing line still bounces.
  const held = (under?.len ?? 0) * eighthMs / 1000;
  if (under) tone({ freq: midiFreq(under.midi), attack: Math.min(0.4, held * 0.3), decay: Math.min(4, held * 0.6 + 0.5), gain: 0.065, lowpass: 600, out: bus });
  beatWatcher?.(beat);
  beat++;
}

export function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = 0;
  live = null;
  if (!shared) return;
  const { ac } = shared;
  for (const n of musicNodes) {
    if (n instanceof GainNode) n.gain.setTargetAtTime(0, ac.currentTime, 0.4);
  }
  const old = musicNodes;
  musicNodes = [];
  window.setTimeout(() => old.forEach((n) => n.disconnect()), 2000);
}

/** Loops a tune from its start (stopping any other) until stopMusic. */
export function playTune(tune: Tune) {
  stopMusic();
  const { ac, music } = audio();
  const bus = ac.createGain();
  bus.gain.value = 1;
  bus.connect(music);
  musicNodes.push(bus);
  live = { melody: byStep(tune.melody), low: byStep(tune.low), eighthMs: tune.eighthMs, voice: tune.voice ?? "musicbox", bus };
  beat = 0;
  tick();
  musicTimer = window.setInterval(tick, tune.eighthMs);
}

/** Swaps in an edited tune while it plays, carrying on from the same beat. */
export function retune(tune: Tune) {
  if (!live) return;
  const faster = live.eighthMs !== tune.eighthMs;
  live = { ...live, melody: byStep(tune.melody), low: byStep(tune.low), eighthMs: tune.eighthMs, voice: tune.voice ?? "musicbox" };
  if (faster) {
    window.clearInterval(musicTimer);
    musicTimer = window.setInterval(tick, tune.eighthMs);
  }
}

export function playMusic(id: string) {
  const track = TRACKS.find((t) => t.id === id);
  if (track) playTune(track.tune);
}

/** One note on its own, as the editor places it: a melody note in its voice, or a low hum. */
export function previewNote(midi: number, low: boolean, voice: Voice = "musicbox") {
  const { music } = audio();
  if (low) tone({ freq: midiFreq(midi), attack: 0.05, decay: 1, gain: 0.09, lowpass: 600, out: music });
  else sing(voice, midi, 2, music);
}

/** A short pretend turn with the given picks, to judge how they sit together. */
export function playTurn(picks: Record<string, string>) {
  const play = (moment: string, at: number) =>
    window.setTimeout(() => MOMENTS.find((m) => m.id === moment)?.variants.find((v) => v.id === picks[moment])?.play(), at);
  play("pickup", 0);
  play("place", 500);
  play("pickup", 1100);
  play("turn", 1400);
  play("nofit", 1900);
  play("pickup", 2500);
  play("place", 2900);
  play("pickup", 3400);
  play("place", 3800);
  play("unlock", 4600);
  play("spare", 6000);
  play("pickup", 7000);
  play("place", 7400);
  play("snug", 8200);
}

/** Bryce's picks so far (2026-10-27); the lab starts from these. */
export const DEFAULT_PICKS: Record<string, string> = {
  pickup: "softcloth",
  place: "mirror",
  nofit: "wobble",
  turn: "swish",
  undo: "unpick",
  unlock: "kalimba2",
  spare: "flutter",
  hint: "single",
  tie: "settle",
  snug: "cascade",
  tap: "felt",
  pause: "breath",
};

/** Turns game sounds on with these picks, or off with null. */
export function setGameSounds(picks: Record<string, string> | null) {
  gamePicks = picks;
}

/** Plays this moment's picked sound, when game sounds are on. */
export function sfx(moment: string) {
  if (!gamePicks) return;
  MOMENTS.find((m) => m.id === moment)?.variants.find((v) => v.id === gamePicks![moment])?.play();
}
