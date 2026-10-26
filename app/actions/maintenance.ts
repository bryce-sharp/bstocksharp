"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { maintenanceRecords } from "@/lib/db/schema";
import { requireVehicleEditor } from "@/lib/authz";
import { requireApp } from "@/lib/hub-apps";

function parseRecord(formData: FormData) {
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
    serviceType: String(formData.get("serviceType") ?? "").trim(),
    category: str("category"),
    serviceDate: str("serviceDate"),
    mileage: int("mileage"),
    cost: str("cost"), // numeric column takes a string
    vendor: str("vendor"),
    notes: str("notes"),
    nextDueDate: str("nextDueDate"),
    nextDueMileage: int("nextDueMileage"),
  };
}

const back = (vehicleId: number) => `/garage/${vehicleId}?tab=maintenance`;

export async function addMaintenance(
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseRecord(formData);
  if (!data.serviceType) throw new Error("Service type is required.");
  if (!data.serviceDate) throw new Error("Service date is required.");

  await db.insert(maintenanceRecords).values({
    ...data,
    vehicleId,
    serviceType: data.serviceType,
    serviceDate: data.serviceDate,
  });

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function updateMaintenance(
  id: number,
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseRecord(formData);
  if (!data.serviceType) throw new Error("Service type is required.");
  if (!data.serviceDate) throw new Error("Service date is required.");

  await db
    .update(maintenanceRecords)
    .set({ ...data, serviceType: data.serviceType, serviceDate: data.serviceDate })
    .where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function deleteMaintenance(
  id: number,
  vehicleId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db.delete(maintenanceRecords).where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}
