import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  profiles,
  exercises,
  workouts,
  workoutItems,
  workoutAssignments,
} from "@/lib/db/schema";
import type { Workout, WorkoutItem, Exercise } from "@/lib/db/schema";
import { resolveItem, type ResolvedItem } from "@/lib/workout";
import { requireGroupId } from "@/lib/session";
import { profileInGroup } from "./scope";
import { requireView } from "@/lib/sharing";
// Profiles are hub-wide now — reads live in ./profiles.
import { getProfile } from "./profiles";

// TENANCY: the catalog carries group_id directly; workouts inherit their group
// through the creator's profile (createdByProfileId), items/assignments through
// their workout/profile. Item queries take a workoutId that has already been
// validated by a scoped getWorkout — the joins here are belt-and-suspenders.

// ── Exercise catalog ──────────────────────────────────────────────────────────
export async function listExercises() {
  const groupId = await requireGroupId();
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.groupId, groupId))
    .orderBy(asc(exercises.category), asc(exercises.name));
}

export async function getExercise(id: number) {
  const groupId = await requireGroupId();
  const rows = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.groupId, groupId)))
    .limit(1);
  return rows[0] ?? null;
}

/** How many workout items reference an exercise (guards catalog deletes). */
export async function countExerciseUsage(id: number): Promise<number> {
  const groupId = await requireGroupId();
  const [row] = await db
    .select({ n: count() })
    .from(workoutItems)
    .innerJoin(workouts, eq(workoutItems.workoutId, workouts.id))
    .where(
      and(
        eq(workoutItems.exerciseId, id),
        profileInGroup(workouts.createdByProfileId, groupId),
      ),
    );
  return row?.n ?? 0;
}

// ── Workouts (a library shared within the group) ──────────────────────────────
export type WorkoutListRow = {
  id: number;
  name: string;
  rounds: number;
  createdByProfileId: number;
  createdByName: string | null;
};

/** Every workout in the group's library, tagged with who saved it. */
export async function listWorkoutsWithCreator(): Promise<WorkoutListRow[]> {
  const groupId = await requireGroupId();
  return db
    .select({
      id: workouts.id,
      name: workouts.name,
      rounds: workouts.rounds,
      createdByProfileId: workouts.createdByProfileId,
      createdByName: profiles.name,
    })
    .from(workouts)
    .innerJoin(profiles, eq(workouts.createdByProfileId, profiles.id))
    .where(eq(profiles.groupId, groupId))
    .orderBy(asc(workouts.sortOrder), asc(workouts.id));
}

export async function getWorkout(id: number): Promise<Workout | null> {
  const groupId = await requireGroupId();
  const rows = await db
    .select()
    .from(workouts)
    .where(
      and(eq(workouts.id, id), profileInGroup(workouts.createdByProfileId, groupId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type WorkoutWithItems = {
  workout: Workout;
  creatorName: string | null;
  items: ResolvedItem[];
};

/** A workout plus its items resolved against the catalog defaults, in order. */
export async function getWorkoutWithItems(
  id: number,
): Promise<WorkoutWithItems | null> {
  const workout = await getWorkout(id); // group-scoped
  if (!workout) return null;

  const creator = await getProfile(workout.createdByProfileId);

  const rows = await db
    .select({ item: workoutItems, exercise: exercises })
    .from(workoutItems)
    .innerJoin(exercises, eq(workoutItems.exerciseId, exercises.id))
    .where(eq(workoutItems.workoutId, id))
    .orderBy(asc(workoutItems.sortOrder), asc(workoutItems.id));

  return {
    workout,
    creatorName: creator?.name ?? null,
    items: rows.map((r) => resolveItem(r.item, r.exercise)),
  };
}

/** All items of a workout with their catalog exercises, in order (for the builder). */
export async function getWorkoutItemsWithExercises(
  workoutId: number,
): Promise<{ item: WorkoutItem; exercise: Exercise }[]> {
  const groupId = await requireGroupId();
  return db
    .select({ item: workoutItems, exercise: exercises })
    .from(workoutItems)
    .innerJoin(exercises, eq(workoutItems.exerciseId, exercises.id))
    .innerJoin(workouts, eq(workoutItems.workoutId, workouts.id))
    .where(
      and(
        eq(workoutItems.workoutId, workoutId),
        profileInGroup(workouts.createdByProfileId, groupId),
      ),
    )
    .orderBy(asc(workoutItems.sortOrder), asc(workoutItems.id));
}

// ── Scheduling (per-profile weekday → workout) ────────────────────────────────
export type AssignmentRow = {
  weekday: number;
  workoutId: number;
  workoutName: string;
  rounds: number;
};

/** A profile's assigned days (only weekdays that have a workout). */
export async function getAssignments(profileId: number): Promise<AssignmentRow[]> {
  await requireView(profileId, "workout");
  const groupId = await requireGroupId();
  return db
    .select({
      weekday: workoutAssignments.weekday,
      workoutId: workouts.id,
      workoutName: workouts.name,
      rounds: workouts.rounds,
    })
    .from(workoutAssignments)
    .innerJoin(workouts, eq(workoutAssignments.workoutId, workouts.id))
    .where(
      and(
        eq(workoutAssignments.profileId, profileId),
        profileInGroup(workoutAssignments.profileId, groupId),
      ),
    )
    .orderBy(asc(workoutAssignments.weekday));
}
