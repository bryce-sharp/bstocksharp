// Keeps a signed-in player's results in step with their account. The browser stays the working copy:
// on load it merges the account's days in and uploads anything only the browser has; after that each
// finish is saved at once and the unfinished game a couple of seconds after it changes.

import { loadSnugDays, saveSnugDays, type SnugUpload } from "@/app/actions/snug";
import { GAME, isBetter, type Progress } from "./records";
import { isCurrent } from "./version";
import type { Attempt } from "./parts";

const OWNER_KEY = `${GAME}.owner`;
const KINDS = ["attempt", "best", "progress"] as const;
const DAY_KEY = new RegExp(`^${GAME}\\.(attempt|best|progress)\\.(\\d{4}-\\d{2}-\\d{2})$`);
const UPLOAD_BATCH = 100;
const PROGRESS_DELAY_MS = 2000;

const keyFor = (kind: (typeof KINDS)[number], dateKey: string) => `${GAME}.${kind}.${dateKey}`;

/** The signed-in person whose account receives saves; null keeps everything on this device. */
let owner: number | null = null;
const pendingProgress = new Map<string, Progress | null>();
let progressTimer = 0;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the account still has the day.
  }
}

function localDates(): string[] {
  const dates = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = DAY_KEY.exec(localStorage.key(i) ?? "");
      if (m) dates.add(m[2]!);
    }
  } catch {
    // Unreadable storage holds nothing to merge.
  }
  return [...dates];
}

async function upload(days: SnugUpload[]) {
  for (let i = 0; i < days.length; i += UPLOAD_BATCH) await saveSnugDays(days.slice(i, i + UPLOAD_BATCH));
}

/** Merges the account's days into this browser and uploads what only the browser has; saves go to the account afterwards. */
export async function syncSnug(profileId: number): Promise<void> {
  const remote = new Map((await loadSnugDays()).map((d) => [d.dateKey, d]));
  // Results stored here for someone else are already in their account; this person starts from their own.
  const storedOwner = read<number>(OWNER_KEY);
  if (storedOwner !== null && storedOwner !== profileId) {
    for (const d of localDates()) for (const kind of KINDS) write(keyFor(kind, d), null);
  }
  write(OWNER_KEY, profileId);

  const uploads: SnugUpload[] = [];
  for (const dateKey of new Set([...remote.keys(), ...localDates()])) {
    const raw = remote.get(dateKey);
    // The account may still hold runs from older puzzles; only current ones are merged.
    const r = raw && { attempt: isCurrent(raw.attempt) ? raw.attempt : null, best: isCurrent(raw.best) ? raw.best : null, progress: isCurrent(raw.progress) ? raw.progress : null };
    const up: SnugUpload = { dateKey };

    // The first scored run stands, so the account's copy wins; one only this browser has goes up.
    const localAttempt = read<Attempt>(keyFor("attempt", dateKey));
    const remoteAttempt = (r?.attempt ?? null) as Attempt | null;
    if (remoteAttempt) write(keyFor("attempt", dateKey), remoteAttempt);
    else if (localAttempt) up.attempt = localAttempt;

    const localBest = read<Attempt>(keyFor("best", dateKey));
    const remoteBest = (r?.best ?? null) as Attempt | null;
    if (remoteBest && (!localBest || isBetter(remoteBest, localBest))) write(keyFor("best", dateKey), remoteBest);
    if (localBest && (!remoteBest || isBetter(localBest, remoteBest))) up.best = localBest;

    // The unfinished game that has been played longer wins.
    const localProgress = read<Progress>(keyFor("progress", dateKey));
    const remoteProgress = (r?.progress ?? null) as Progress | null;
    if (remoteProgress && (!localProgress || remoteProgress.elapsedMs > localProgress.elapsedMs)) write(keyFor("progress", dateKey), remoteProgress);
    if (localProgress?.started && !up.attempt && !up.best && (!remoteProgress || localProgress.elapsedMs > remoteProgress.elapsedMs)) up.progress = localProgress;

    if (up.attempt || up.best || "progress" in up) uploads.push(up);
  }
  await upload(uploads);
  owner = profileId;
}

/** Saves a finished run to the account: `attempt` when it was the scored first run, and the day's best run. */
export function saveRunRemote(dateKey: string, attempt: Attempt | null, best: Attempt) {
  if (owner === null) return;
  // A finish supersedes any unfinished game still waiting to go up.
  pendingProgress.delete(dateKey);
  void saveSnugDays([{ dateKey, attempt, best }]).catch(() => {});
}

/** Queues the unfinished game for the account, sent once it stops changing for a moment. */
export function saveProgressRemote(dateKey: string, progress: Progress | null) {
  if (owner === null) return;
  pendingProgress.set(dateKey, progress);
  window.clearTimeout(progressTimer);
  progressTimer = window.setTimeout(flushRemote, PROGRESS_DELAY_MS);
}

/** Sends any queued unfinished game now, for when the page is being hidden or closed. */
export function flushRemote() {
  window.clearTimeout(progressTimer);
  if (owner === null || pendingProgress.size === 0) return;
  const days = [...pendingProgress].map(([dateKey, progress]) => ({ dateKey, progress }));
  pendingProgress.clear();
  void saveSnugDays(days).catch(() => {});
}
