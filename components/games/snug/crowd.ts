// Everyone's totals for a Snug day or month, from every player's saved rows. Pure, so the server action stays thin.
// Nothing here ever returns one person's row; any time shown comes from at least MIN_CROWD different players.

import { mean, median } from "./average";

/** Fewer players than this and a figure stays hidden: it would be one or two people's results. */
export const MIN_CROWD = 3;

/** One player's saved day, as the crowd query reads it; fields are null when missing, malformed or from older puzzles. */
export type CrowdRow = { profileId: number; gaps: number | null; timeMs: number | null; hints: number | null; bestGaps: number | null };

/** How everyone did on one day. Times need MIN_CROWD perfect players; `beat` is the share of other runs `mine` beats. */
export type DayCrowd = { players: number; perfect: number; enough: boolean; medianMs: number | null; meanMs: number | null; beat: number | null };

/** How everyone did in one month; the quilt counts only once the month is over. */
export type MonthCrowd = {
  players: number;
  enough: boolean;
  medianDays: number | null;
  medianMs: number | null;
  meanMs: number | null;
  completed: number | null;
  perfectMonths: number | null;
};

type Run = { profileId: number; gaps: number; hints: number; timeMs: number };

const count = (n: number | null): n is number => n !== null && Number.isInteger(n) && n >= 0;

/** Scored runs whose numbers make sense; anything else is left out rather than breaking the totals. */
function scoredRuns(rows: CrowdRow[]): Run[] {
  return rows.flatMap((r) =>
    count(r.gaps) && r.timeMs !== null && Number.isFinite(r.timeMs) && r.timeMs >= 0
      ? [{ profileId: r.profileId, gaps: r.gaps, hints: count(r.hints) ? r.hints : 0, timeMs: r.timeMs }]
      : [],
  );
}

/** The game's order for runs: fewer holes, then fewer hints, then faster. Negative when `a` is better. */
const compareRuns = (a: Omit<Run, "profileId">, b: Omit<Run, "profileId">) => a.gaps - b.gaps || a.hints - b.hints || a.timeMs - b.timeMs;

/** Typical and average time of perfect runs, only when MIN_CROWD different players made them. */
function crowdTimes(runs: Run[]): { medianMs: number | null; meanMs: number | null } {
  const perfect = runs.filter((r) => r.gaps === 0);
  if (new Set(perfect.map((r) => r.profileId)).size < MIN_CROWD) return { medianMs: null, meanMs: null };
  const times = perfect.map((r) => r.timeMs);
  return { medianMs: median(times), meanMs: mean(times) };
}

export function dayCrowd(rows: CrowdRow[], mine?: Omit<Run, "profileId">): DayCrowd {
  const runs = scoredRuns(rows);
  const enough = runs.length >= MIN_CROWD;
  let beat: number | null = null;
  if (enough && mine && [mine.gaps, mine.hints, mine.timeMs].every(Number.isFinite)) {
    // Ties, your own run among them, count neither way.
    const order = runs.map((r) => compareRuns(r, mine));
    const better = order.filter((o) => o < 0).length;
    const worse = order.filter((o) => o > 0).length;
    beat = better + worse ? worse / (better + worse) : null;
  }
  return { players: runs.length, perfect: runs.filter((r) => r.gaps === 0).length, enough, ...crowdTimes(runs), beat };
}

/** `days` is the month's length; `over` says whether it has ended, so whole-month counts can show. */
export function monthCrowd(rows: CrowdRow[], days: number, over: boolean): MonthCrowd {
  const runs = scoredRuns(rows);
  const perPlayer = new Map<number, { played: number; perfect: number; filled: number }>();
  for (const r of runs) {
    const p = perPlayer.get(r.profileId) ?? { played: 0, perfect: 0, filled: 0 };
    p.played++;
    if (r.gaps === 0) p.perfect++;
    perPlayer.set(r.profileId, p);
  }
  // A day filled later counts toward a finished quilt even without a scored run.
  for (const r of rows) {
    if (r.bestGaps !== 0 && !(count(r.gaps) && r.gaps === 0)) continue;
    const p = perPlayer.get(r.profileId) ?? { played: 0, perfect: 0, filled: 0 };
    p.filled++;
    perPlayer.set(r.profileId, p);
  }
  const players = [...perPlayer.values()].filter((p) => p.played > 0);
  const enough = players.length >= MIN_CROWD;
  return {
    players: players.length,
    enough,
    medianDays: enough ? median(players.map((p) => p.played)) : null,
    ...(enough ? crowdTimes(runs) : { medianMs: null, meanMs: null }),
    completed: enough && over ? [...perPlayer.values()].filter((p) => p.filled === days).length : null,
    perfectMonths: enough && over ? players.filter((p) => p.perfect === days).length : null,
  };
}
