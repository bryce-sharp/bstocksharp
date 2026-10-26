"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { wishlistItems } from "@/lib/db/schema";
import { requireVehicleEditor } from "@/lib/authz";
import { requireApp } from "@/lib/hub-apps";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseItem(formData: FormData) {
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

  const purchased = formData.get("purchased") != null;
  return {
    item: String(formData.get("item") ?? "").trim(),
    brand: str("brand"),
    price: str("price"),
    rating: int("rating"),
    priority: str("priority") ?? "medium",
    link: str("link"),
    purchased,
    purchasedDate: purchased ? todayISO() : null,
    notes: str("notes"),
  };
}

const back = (vehicleId: number) => `/garage/${vehicleId}?tab=wishlist`;

export async function addWishlistItem(
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseItem(formData);
  if (!data.item) throw new Error("Item name is required.");

  await db.insert(wishlistItems).values({ ...data, vehicleId, item: data.item });

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function updateWishlistItem(
  id: number,
  vehicleId: number,
  formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  const data = parseItem(formData);
  if (!data.item) throw new Error("Item name is required.");

  await db
    .update(wishlistItems)
    .set({ ...data, item: data.item })
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

export async function deleteWishlistItem(
  id: number,
  vehicleId: number,
  _formData: FormData,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db.delete(wishlistItems).where(and(eq(wishlistItems.id, id), eq(wishlistItems.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
  redirect(back(vehicleId));
}

/** Optimistic purchased toggle — called directly, no redirect. */
export async function toggleWishlistPurchased(
  id: number,
  vehicleId: number,
  purchased: boolean,
): Promise<void> {
  await requireApp("garage");
  await requireVehicleEditor(vehicleId);
  await db
    .update(wishlistItems)
    .set({ purchased, purchasedDate: purchased ? todayISO() : null })
    .where(and(eq(wishlistItems.id, id), eq(wishlistItems.vehicleId, vehicleId)));

  revalidatePath(`/garage/${vehicleId}`);
}
