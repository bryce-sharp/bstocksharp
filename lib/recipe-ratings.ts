// How a recipe's stars add up (docs/recipes/plan.md, "Ratings and favorites"). Pure, so the card, the recipe
// page and the list's filters all read the same numbers.

export type RatingLog = { profileId: number; cookedOn: string; rating: number | null; counted: boolean; recipeVersion: number };

/** A rating's weight halves every six months, so changing tastes show without one night swinging it. */
export const HALF_LIFE_DAYS = 182.5;
/** A trend needs this many counted ratings, and the recent ones must differ from the rest by this many stars. */
const TREND_MIN_RATINGS = 4;
const TREND_STARS = 0.75;

export type PersonRating = { profileId: number; rating: number; count: number };

export type RatingSummary = {
  /** untried: never cooked; unrated: cooked, no counted stars; newVersion: rated only before the latest change. */
  state: "untried" | "unrated" | "rated" | "newVersion";
  overall: number | null;
  people: PersonRating[];
  /** The overall of the last version that had ratings, shown until the new one is rated. */
  before: number | null;
  trend: "up" | "down" | null;
  cooked: number;
  lastCooked: string | null;
};

const DAY_MS = 86_400_000;
const dayNumber = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) / DAY_MS;

type Rated = RatingLog & { rating: number };
const isRated = (l: RatingLog): l is Rated => l.counted && l.rating !== null;

/** Each person's recency-weighted average, then the plain average across people, so one keen cook still counts once. */
function overallOf(rated: Rated[], today: string): { overall: number | null; people: PersonRating[] } {
  const byPerson = new Map<number, { sum: number; weight: number; count: number }>();
  for (const l of rated) {
    const age = Math.max(0, dayNumber(today) - dayNumber(l.cookedOn));
    const weight = 0.5 ** (age / HALF_LIFE_DAYS);
    const p = byPerson.get(l.profileId) ?? { sum: 0, weight: 0, count: 0 };
    p.sum += l.rating * weight;
    p.weight += weight;
    p.count++;
    byPerson.set(l.profileId, p);
  }
  const people = [...byPerson].map(([profileId, p]) => ({ profileId, rating: p.sum / p.weight, count: p.count }));
  const overall = people.length ? people.reduce((a, p) => a + p.rating, 0) / people.length : null;
  return { overall, people };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Up or down when the latest third of the ratings (at least two) clearly differs from the ones before. */
function trendOf(rated: Rated[]): "up" | "down" | null {
  if (rated.length < TREND_MIN_RATINGS) return null;
  const sorted = [...rated].sort((a, b) => a.cookedOn.localeCompare(b.cookedOn));
  const recentCount = Math.max(2, Math.floor(sorted.length / 3));
  const diff = mean(sorted.slice(-recentCount).map((l) => l.rating)) - mean(sorted.slice(0, -recentCount).map((l) => l.rating));
  if (diff >= TREND_STARS) return "up";
  if (diff <= -TREND_STARS) return "down";
  return null;
}

export function summarizeRatings(logs: RatingLog[], version: number, today: string): RatingSummary {
  const lastCooked = logs.reduce<string | null>((a, l) => (a === null || l.cookedOn > a ? l.cookedOn : a), null);
  const base = { cooked: logs.length, lastCooked };
  if (logs.length === 0) return { ...base, state: "untried", overall: null, people: [], before: null, trend: null };

  const current = logs.filter((l) => l.recipeVersion === version && isRated(l)) as Rated[];
  if (current.length) {
    return { ...base, state: "rated", ...overallOf(current, today), before: null, trend: trendOf(current) };
  }
  const older = logs.filter((l) => l.recipeVersion < version && isRated(l)) as Rated[];
  if (older.length) {
    const lastVersion = Math.max(...older.map((l) => l.recipeVersion));
    const before = overallOf(older.filter((l) => l.recipeVersion === lastVersion), today).overall;
    return { ...base, state: "newVersion", overall: null, people: [], before, trend: null };
  }
  return { ...base, state: "unrated", overall: null, people: [], before: null, trend: null };
}
