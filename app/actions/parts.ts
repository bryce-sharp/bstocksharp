"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schema";
import { requireVehicleEditor } from "@/lib/authz";
import { requireApp } from "@/lib/hub-apps";

function parsePart(formData: FormData) {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  return {
    name: String(formData.get("name") ?? "").trim(),
    brand: str("brand"),
    partNumber: str("partNumber"),
    category: str("category"),
    link: str("link"),
    cost: str("cost"),
    installedDate: str("installedDate"),
    notes: str("notes"),
  };
}

const back = (vehicleId: number) => `/garage/${vehicleId}?tab=parts`;

export async function addPart(
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parsePart(formData);
  if (!data.name) throw new Error("Part name is required.");

  await db.insert(parts).values({ ...data, vehicleId, name: data.name });

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function updatePart(
  id: number,
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parsePart(formData);
  if (!data.name) throw new Error("Part name is required.");

  await db
    .update(parts)
    .set({ ...data, name: data.name })
    .where(and(eq(parts.id, id), eq(parts.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function deletePart(
  id: number,
  vehicleId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db.delete(parts).where(and(eq(parts.id, id), eq(parts.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}
