// Shared helpers for Bryce's daily games: date keys, seeded randomness, and the one-recorded-attempt store.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function localDateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today's key in the player's timezone; in development, `?date=YYYY-MM-DD` overrides it for testing. */
export function todayKey(): string {
  if (process.env.NODE_ENV === "production") return localDateKey();
  const override = new URLSearchParams(window.location.search).get("date");
  return override && DATE_RE.test(override) ? override : localDateKey();
}

/** Day of the week for a date key, 0 = Sunday. */
export function weekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getDay();
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y!, m! - 1, d! + days));
}

/** 1-based puzzle number counted from the game's launch date. */
export function puzzleNumber(key: string, launchKey: string): number {
  return dayNumber(key) - dayNumber(launchKey) + 1;
}

export function formatLongDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function formatShortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

/** Deterministic mulberry32 generator seeded from a string. */
export function makeRng(seed: string): Rng {
  let a = hashString(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    pick: (items) => items[int(items.length)]!,
    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

const attemptKey = (game: string, dateKey: string) => `${game}.attempt.${dateKey}`;

export function loadAttempt<T>(game: string, dateKey: string): T | null {
  try {
    const raw = localStorage.getItem(attemptKey(game, dateKey));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Records the day's attempt only if none exists yet; returns whether it was saved. */
export function saveAttempt<T>(game: string, dateKey: string, value: T): boolean {
  try {
    if (localStorage.getItem(attemptKey(game, dateKey))) return false;
    localStorage.setItem(attemptKey(game, dateKey), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
