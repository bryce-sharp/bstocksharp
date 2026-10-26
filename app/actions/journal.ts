"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { requireVehicleEditor } from "@/lib/authz";
import { requireApp } from "@/lib/hub-apps";

function parseEntry(formData: FormData) {
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

  return {
    entryDate: str("entryDate"),
    title: str("title"),
    body: String(formData.get("body") ?? "").trim(),
    mileage: int("mileage"),
  };
}

const back = (vehicleId: number) => `/garage/${vehicleId}?tab=journal`;

export async function addJournal(
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseEntry(formData);
  if (!data.entryDate) throw new Error("Date is required.");
  if (!data.body) throw new Error("Entry text is required.");

  await db.insert(journalEntries).values({
    ...data,
    vehicleId,
    entryDate: data.entryDate,
    body: data.body,
  });

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function updateJournal(
  id: number,
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseEntry(formData);
  if (!data.entryDate) throw new Error("Date is required.");
  if (!data.body) throw new Error("Entry text is required.");

  await db
    .update(journalEntries)
    .set({ ...data, entryDate: data.entryDate, body: data.body })
    .where(and(eq(journalEntries.id, id), eq(journalEntries.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function deleteJournal(
  id: number,
  vehicleId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db.delete(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}
