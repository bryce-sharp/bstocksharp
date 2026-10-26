"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fuelLogs } from "@/lib/db/schema";
import { requireVehicleEditor } from "@/lib/authz";
import { requireApp } from "@/lib/hub-apps";

function parseFuel(formData: FormData) {
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
    fillDate: str("fillDate"),
    odometer: int("odometer"),
    gallons: str("gallons"),
    pricePerGallon: str("pricePerGallon"),
    totalCost: str("totalCost"),
    isFullTank: formData.get("isFullTank") != null,
    notes: str("notes"),
  };
}

const back = (vehicleId: number) => `/garage/${vehicleId}?tab=fuel`;

export async function addFuel(
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseFuel(formData);
  if (!data.fillDate) throw new Error("Fill date is required.");

  await db.insert(fuelLogs).values({
    ...data,
    vehicleId,
    fillDate: data.fillDate,
  });

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function updateFuel(
  id: number,
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseFuel(formData);
  if (!data.fillDate) throw new Error("Fill date is required.");

  await db
    .update(fuelLogs)
    .set({ ...data, fillDate: data.fillDate })
    .where(and(eq(fuelLogs.id, id), eq(fuelLogs.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function deleteFuel(
  id: number,
  vehicleId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db.delete(fuelLogs).where(and(eq(fuelLogs.id, id), eq(fuelLogs.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}
