// Which puzzles a saved run was played on. Version 2 is the month quilts (from October 2026); runs saved before
// them, with no version, belong to boards that no longer exist and are ignored and cleared everywhere.
export const PUZZLE_VERSION = 2;

/** True when a saved run, best run or unfinished game was played on the current puzzles. */
export const isCurrent = (record: unknown): boolean =>
  !!record && typeof record === "object" && (record as { v?: unknown }).v === PUZZLE_VERSION;
