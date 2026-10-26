"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercises,
  workouts,
  workoutItems,
  workoutAssignments,
} from "@/lib/db/schema";
import type { Exercise } from "@/lib/db/schema";
import { requireEditor, requireEditorFor } from "@/lib/auth";
import { requireWorkoutEditor } from "@/lib/authz";
import { getActiveProfile } from "@/lib/profile";
import { requireGroupId } from "@/lib/session";
import { getProfile } from "@/lib/queries/profiles";
import { countExerciseUsage, getExercise, getWorkout } from "@/lib/queries/workout";
import { RUN_TIMING } from "@/lib/workout-config";
import { cleanEquipment, SECTIONS } from "@/lib/workout";
import { requireApp } from "@/lib/hub-apps";

const CATALOG = "/workout/catalog";

// Empty string → null; keeps optional columns clean.
function str(formData: FormData, k: string): string | null {
  const v = String(formData.get(k) ?? "").trim();
  return v === "" ? null : v;
}
function int(formData: FormData, k: string): number | null {
  const v = str(formData, k);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

// EquipmentPicker posts a JSON array of slugs in one hidden field; parse it and
// keep only known slugs so a stale/bogus value can never persist.
function equip(formData: FormData): string[] {
  const raw = formData.get("equipment");
  if (typeof raw !== "string" || !raw) return [];
  try {
    return cleanEquipment(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseExercise(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    category: str(formData, "category"),
    defaultReps: str(formData, "defaultReps"),
    defaultDuration: int(formData, "defaultDuration"),
    defaultWeight: str(formData, "defaultWeight"),
    holdLast: formData.get("holdLast") != null, // checkbox present = on
    sides: formData.get("perSide") != null ? 2 : 1, // checkbox present = per side
    equipment: equip(formData), // intrinsic gear this move needs (catalog-only)
    description: str(formData, "description"),
    tips: str(formData, "tips"), // textarea, one tip per line
  };
}

export async function addExercise(formData: FormData): Promise<void> {
  await requireApp("workout");
  await requireEditor();
  const data = parseExercise(formData);
  if (!data.name) throw new Error("Exercise name is required.");

  await db
    .insert(exercises)
    .values({ ...data, name: data.name, groupId: await requireGroupId() });

  revalidatePath(CATALOG);
  redirect(CATALOG);
}

export async function updateExercise(
  id: number,
  formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireEditor();
  const data = parseExercise(formData);
  if (!data.name) throw new Error("Exercise name is required.");

  await db
    .update(exercises)
    .set({ ...data, name: data.name })
    .where(and(eq(exercises.id, id), eq(exercises.groupId, await requireGroupId())));

  revalidatePath(CATALOG);
  redirect(CATALOG);
}

export async function deleteExercise(
  id: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireEditor();

  // Guard: don't orphan workout items. Send back with a message instead of
  // silently deleting (or crashing on the FK).
  const uses = await countExerciseUsage(id);
  if (uses > 0) {
    redirect(`${CATALOG}?blocked=${id}&uses=${uses}`);
  }

  await db
    .delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.groupId, await requireGroupId())));

  revalidatePath(CATALOG);
  redirect(CATALOG);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKOUTS (the shared library) + their items — the builder's write side.
// ─────────────────────────────────────────────────────────────────────────────

const builderPath = (id: number) => `/workout/${id}/edit`;

function parseWorkout(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    rounds: Math.max(1, int(formData, "rounds") ?? 1),
    restBetweenRounds: Math.max(
      0,
      int(formData, "restBetweenRounds") ?? RUN_TIMING.defaultRestBetweenRounds,
    ),
    createdByProfileId: int(formData, "createdByProfileId"),
  };
}

// ── One-page create (components/workout/WorkoutDraftBuilder) ──────────────────
// The draft builder holds the whole workout in client state and posts it here
// once: meta fields + an `items` hidden field (JSON array of draft items in
// display order). Item values are the EFFECTIVE values shown in the draft, so
// each is diffed against its catalog default and only genuine overrides persist
// (same rule as updateWorkoutItem).

type DraftItem = {
  exerciseId: number;
  section: string;
  reps: string | null;
  duration: number | null;
  weight: string | null;
  holdLast: boolean;
  note: string | null;
};

function parseDraftItems(formData: FormData): DraftItem[] {
  const raw = formData.get("items");
  if (typeof raw !== "string" || !raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const knownSections = new Set<string>(SECTIONS.map((s) => s.value));
  const asStr = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t === "" ? null : t;
  };

  return parsed.slice(0, 100).flatMap((entry): DraftItem[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const o = entry as Record<string, unknown>;
    const exerciseId = Number(o.exerciseId);
    if (!Number.isInteger(exerciseId)) return [];
    // NB: Number(null) is 0 — bail to null before coercing so "no duration"
    // never turns into a 0-second timer.
    const duration = o.duration == null ? null : Number(o.duration);
    return [
      {
        exerciseId,
        section:
          typeof o.section === "string" && knownSections.has(o.section)
            ? o.section
            : "main",
        reps: asStr(o.reps),
        duration:
          duration != null && Number.isInteger(duration) && duration >= 0
            ? duration
            : null,
        weight: asStr(o.weight),
        holdLast: o.holdLast === true,
        note: asStr(o.note),
      },
    ];
  });
}

export async function createWorkoutWithItems(formData: FormData): Promise<void> {
  await requireApp("workout");
  const { name, rounds, restBetweenRounds, createdByProfileId } =
    parseWorkout(formData);
  if (!name) throw new Error("Workout name is required.");
  if (!createdByProfileId) throw new Error("Choose who's saving this workout.");
  // The person it's saved-by owns it, so they must be unlocked to create it.
  await requireEditorFor(createdByProfileId);

  // Only OUR catalog's exercises can be referenced — foreign ids are dropped.
  const groupId = await requireGroupId();
  const catalog = await db
    .select()
    .from(exercises)
    .where(eq(exercises.groupId, groupId));
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const draft = parseDraftItems(formData).filter((it) => byId.has(it.exerciseId));

  // Persist in section-canonical order (warmup → main → cooldown), matching how
  // the draft renders. Stable sort keeps the user's order within each section.
  const rank = new Map<string, number>(SECTIONS.map((s, i) => [s.value, i]));
  draft.sort((a, b) => (rank.get(a.section) ?? 9) - (rank.get(b.section) ?? 9));

  const [row] = await db
    .insert(workouts)
    .values({ name, rounds, restBetweenRounds, createdByProfileId })
    .returning({ id: workouts.id });

  if (draft.length) {
    await db.insert(workoutItems).values(
      draft.map((it, i) => {
        const ex = byId.get(it.exerciseId)!;
        return {
          workoutId: row.id,
          exerciseId: it.exerciseId,
          section: it.section,
          reps: overrideStr(it.reps, ex.defaultReps),
          duration: overrideNum(it.duration, ex.defaultDuration),
          weight: overrideStr(it.weight, ex.defaultWeight),
          holdLast: overrideBool(it.holdLast, ex.holdLast),
          note: it.note,
          sortOrder: i,
        };
      }),
    );
  }

  // "Build a workout for this day" flow: auto-assign it to that weekday.
  const assignWeekday = int(formData, "assignWeekday");
  if (assignWeekday != null) {
    await db
      .insert(workoutAssignments)
      .values({ profileId: createdByProfileId, weekday: assignWeekday, workoutId: row.id })
      .onConflictDoUpdate({
        target: [workoutAssignments.profileId, workoutAssignments.weekday],
        set: { workoutId: row.id },
      });
  }

  revalidatePath("/workout");
  redirect(`/workout/${row.id}`); // straight to the finished workout
}

export async function updateWorkout(
  id: number,
  formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireWorkoutEditor(id);
  const { name, rounds, restBetweenRounds, createdByProfileId } =
    parseWorkout(formData);
  if (!name) throw new Error("Workout name is required.");

  // Reassigning "saved by" must stay within the group.
  if (createdByProfileId && !(await getProfile(createdByProfileId))) {
    throw new Error("Profile not found.");
  }

  await db
    .update(workouts)
    .set({
      name,
      rounds,
      restBetweenRounds,
      ...(createdByProfileId ? { createdByProfileId } : {}),
    })
    .where(eq(workouts.id, id));

  // Auto-save: revalidate in place, stay in the builder (no navigation).
  revalidatePath("/workout");
  revalidatePath(`/workout/${id}`);
  revalidatePath(`/workout/${id}/edit`);
}

export async function deleteWorkout(
  id: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireWorkoutEditor(id);
  // Cascades to workout_items and workout_assignments (FK onDelete: cascade).
  await db.delete(workouts).where(eq(workouts.id, id));

  revalidatePath("/workout");
  redirect("/workout");
}

/**
 * Duplicate any workout onto the ACTIVE profile's side (name + " (copy)"), items
 * and all. Since workouts are edit-owned now, this is how you take someone else's
 * routine and tweak your own version. You must be unlocked (it becomes yours).
 */
export async function copyWorkout(
  sourceId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("workout");
  const active = await getActiveProfile();
  if (!active) throw new Error("No active profile to copy to.");
  await requireEditorFor(active.id);

  const src = await getWorkout(sourceId); // group-scoped: no copying across groups
  if (!src) throw new Error("Workout not found.");

  const [copy] = await db
    .insert(workouts)
    .values({
      createdByProfileId: active.id,
      name: `${src.name} (copy)`,
      rounds: src.rounds,
      restBetweenRounds: src.restBetweenRounds,
      notes: src.notes,
    })
    .returning({ id: workouts.id });

  const items = await db
    .select()
    .from(workoutItems)
    .where(eq(workoutItems.workoutId, sourceId))
    .orderBy(asc(workoutItems.sortOrder), asc(workoutItems.id));
  if (items.length) {
    await db.insert(workoutItems).values(
      items.map((it) => ({
        workoutId: copy.id,
        exerciseId: it.exerciseId,
        section: it.section,
        reps: it.reps,
        duration: it.duration,
        weight: it.weight,
        holdLast: it.holdLast,
        note: it.note,
        sortOrder: it.sortOrder,
      })),
    );
  }

  revalidatePath("/workout");
  redirect(builderPath(copy.id)); // drop into the builder to tweak your copy
}

// ── Workout items ─────────────────────────────────────────────────────────────

/** Next free sortOrder for a workout (append to the end). */
async function nextSort(workoutId: number): Promise<number> {
  const rows = await db
    .select({ s: workoutItems.sortOrder })
    .from(workoutItems)
    .where(eq(workoutItems.workoutId, workoutId));
  return rows.reduce((m, r) => Math.max(m, r.s ?? 0), -1) + 1;
}

export async function addWorkoutItem(
  workoutId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireWorkoutEditor(workoutId);
  const exerciseId = int(formData, "exerciseId");
  const section = str(formData, "section") ?? "main";
  if (!exerciseId) throw new Error("Pick an exercise to add.");
  // Only OUR catalog's exercises can be added (foreign id → not found).
  if (!(await getExercise(exerciseId))) throw new Error("Exercise not found.");

  // New items inherit the catalog defaults (all overrides null).
  await db.insert(workoutItems).values({
    workoutId,
    exerciseId,
    section,
    sortOrder: await nextSort(workoutId),
  });

  // No redirect — revalidate in place so the builder doesn't jump to the top.
  revalidatePath(`/workout/${workoutId}`);
  revalidatePath(builderPath(workoutId));
}

// Store a per-item override ONLY when it differs from the catalog default;
// otherwise store null so the item keeps inheriting. This keeps catalog edits
// flowing to any field the user hasn't deliberately changed (the item form is
// prefilled with the effective value, so "unchanged" == "equals the default").
const overrideStr = (v: string | null, def: string | null) =>
  v === null || v === def ? null : v;
const overrideNum = (v: number | null, def: number | null) =>
  v === null || v === def ? null : v;
const overrideBool = (v: boolean, def: boolean) => (v === def ? null : v);

function parseItemOverrides(formData: FormData, exercise: Exercise) {
  return {
    section: str(formData, "section") ?? "main", // item-only field (always set)
    reps: overrideStr(str(formData, "reps"), exercise.defaultReps),
    duration: overrideNum(int(formData, "duration"), exercise.defaultDuration),
    weight: overrideStr(str(formData, "weight"), exercise.defaultWeight),
    holdLast: overrideBool(formData.get("holdLast") != null, exercise.holdLast),
    note: str(formData, "note"), // item-only field (no catalog equivalent)
  };
}

export async function updateWorkoutItem(
  itemId: number,
  workoutId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireWorkoutEditor(workoutId);
  // Fetch the item's catalog exercise so we can diff each field against its
  // default and only persist genuine overrides. The item lookup is BOUND to the
  // guarded workoutId so a foreign item id can't ride in on our own workout.
  const [row] = await db
    .select({ exercise: exercises })
    .from(workoutItems)
    .innerJoin(exercises, eq(workoutItems.exerciseId, exercises.id))
    .where(and(eq(workoutItems.id, itemId), eq(workoutItems.workoutId, workoutId)))
    .limit(1);
  if (!row) return;

  await db
    .update(workoutItems)
    .set(parseItemOverrides(formData, row.exercise))
    .where(and(eq(workoutItems.id, itemId), eq(workoutItems.workoutId, workoutId)));

  revalidatePath(`/workout/${workoutId}`);
  revalidatePath(builderPath(workoutId));
}

export async function removeWorkoutItem(
  itemId: number,
  workoutId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireWorkoutEditor(workoutId);
  await db
    .delete(workoutItems)
    .where(and(eq(workoutItems.id, itemId), eq(workoutItems.workoutId, workoutId)));

  revalidatePath(`/workout/${workoutId}`);
  revalidatePath(builderPath(workoutId));
}

/** Move an item up/down within its own section (swap sortOrder with neighbor). */
export async function moveWorkoutItem(
  itemId: number,
  workoutId: number,
  dir: "up" | "down",
): Promise<void> {
  await requireApp("workout");
  await requireWorkoutEditor(workoutId);
  const rows = await db
    .select()
    .from(workoutItems)
    .where(eq(workoutItems.workoutId, workoutId))
    .orderBy(asc(workoutItems.sortOrder), asc(workoutItems.id));

  const target = rows.find((r) => r.id === itemId);
  if (!target) return;
  const section = rows.filter((r) => r.section === target.section);
  const idx = section.findIndex((r) => r.id === itemId);
  const nIdx = dir === "up" ? idx - 1 : idx + 1;
  if (nIdx < 0 || nIdx >= section.length) return;

  const neighbor = section[nIdx];
  await db
    .update(workoutItems)
    .set({ sortOrder: neighbor.sortOrder })
    .where(eq(workoutItems.id, target.id));
  await db
    .update(workoutItems)
    .set({ sortOrder: target.sortOrder })
    .where(eq(workoutItems.id, neighbor.id));

  revalidatePath(`/workout/${workoutId}`);
}

// ── Scheduling — assign/clear a workout for a profile's weekday ────────────────

/** Set (or clear, when workoutId is empty) a profile's workout for one weekday. */
export async function setAssignment(
  profileId: number,
  weekday: number,
  formData: FormData,
): Promise<void> {
  await requireApp("workout");
  await requireEditorFor(profileId); // your own week — you must be unlocked
  const workoutId = int(formData, "workoutId");
  // Only OUR group's workouts can be scheduled (foreign id → not found).
  if (workoutId && !(await getWorkout(workoutId))) {
    throw new Error("Workout not found.");
  }

  if (!workoutId) {
    await db
      .delete(workoutAssignments)
      .where(
        and(
          eq(workoutAssignments.profileId, profileId),
          eq(workoutAssignments.weekday, weekday),
        ),
      );
  } else {
    await db
      .insert(workoutAssignments)
      .values({ profileId, weekday, workoutId })
      .onConflictDoUpdate({
        target: [workoutAssignments.profileId, workoutAssignments.weekday],
        set: { workoutId },
      });
  }

  revalidatePath("/workout");
  redirect(`/workout/schedule?profile=${profileId}`);
}
