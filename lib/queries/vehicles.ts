import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { canEditProfile } from "@/lib/auth";

/**
 * Vehicles visible to a profile, newest first: anything shared, plus the
 * profile's private cars when this login may see them (its owner's login, or
 * anyone for a person without a login). See ARCHITECTURE "Profiles, visibility & access".
 */
export async function listVehicles(profileId: number) {
  const groupId = await requireGroupId();
  const ownCars = (await canEditProfile(profileId)) ? eq(vehicles.profileId, profileId) : undefined;
  return db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.groupId, groupId), or(eq(vehicles.visibility, "shared"), ownCars)))
    .orderBy(desc(vehicles.createdAt));
}

/** A single vehicle by id, or null: null too for another group's car, or a private car this login may not see. */
export async function getVehicle(id: number) {
  const groupId = await requireGroupId();
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.id, id), eq(vehicles.groupId, groupId)))
    .limit(1);
  const car = rows[0];
  if (!car || (car.visibility === "private" && !(await canEditProfile(car.profileId)))) return null;
  return car;
}
