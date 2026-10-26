"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buildTasks } from "@/lib/db/schema";
import { requireVehicleEditor } from "@/lib/authz";
import { requireApp } from "@/lib/hub-apps";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseTask(formData: FormData) {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const int = (k: string) => {
    const v = str(k);
    if (v === null) return null;
    const n = Number.parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  const status = str("status") ?? "planned";
  return {
    phase: int("phase"),
    title: String(formData.get("title") ?? "").trim(),
    description: str("description"),
    priority: str("priority") ?? "medium",
    status,
    costEstimate: str("costEstimate"),
    actualCost: str("actualCost"),
    completedDate: status === "done" ? todayISO() : null,
  };
}

const back = (vehicleId: number) => `/garage/${vehicleId}?tab=build`;

export async function addBuildTask(
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseTask(formData);
  if (!data.title) throw new Error("Task title is required.");

  await db.insert(buildTasks).values({ ...data, vehicleId, title: data.title });

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function updateBuildTask(
  id: number,
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseTask(formData);
  if (!data.title) throw new Error("Task title is required.");

  await db
    .update(buildTasks)
    .set({ ...data, title: data.title })
    .where(and(eq(buildTasks.id, id), eq(buildTasks.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function deleteBuildTask(
  id: number,
  vehicleId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db.delete(buildTasks).where(and(eq(buildTasks.id, id), eq(buildTasks.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

/**
 * Quick done/undone toggle — called directly (not via form) so the UI can
 * update optimistically. No redirect; just revalidate.
 */
export async function toggleBuildTask(
  id: number,
  vehicleId: number,
  done: boolean,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db
    .update(buildTasks)
    .set({
      status: done ? "done" : "planned",
      completedDate: done ? todayISO() : null,
    })
    .where(and(eq(buildTasks.id, id), eq(buildTasks.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
}
