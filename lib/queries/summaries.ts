import "server-only";
import { and, eq, isNotNull, or, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import { maintenanceRecords, fuelLogs, vehicles } from "@/lib/db/schema";
import { requireGroupId } from "@/lib/session";
import { vehicleInGroup } from "./scope";
import { canEditProfile } from "@/lib/auth";

/** Total spend for a vehicle, split maintenance vs fuel. */
export async function vehicleSpend(vehicleId: number) {
  const groupId = await requireGroupId();
  const [m] = await db
    .select({ total: sum(maintenanceRecords.cost) })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.vehicleId, vehicleId),
        vehicleInGroup(maintenanceRecords.vehicleId, groupId),
      ),
    );
  const [f] = await db
    .select({ total: sum(fuelLogs.totalCost) })
    .from(fuelLogs)
    .where(
      and(eq(fuelLogs.vehicleId, vehicleId), vehicleInGroup(fuelLogs.vehicleId, groupId)),
    );

  const maintenance = Number(m?.total ?? 0);
  const fuel = Number(f?.total ?? 0);
  return { maintenance, fuel, total: maintenance + fuel };
}

/** Service records for one vehicle that carry a next-due reminder. */
export async function listVehicleDueRecords(vehicleId: number) {
  const groupId = await requireGroupId();
  return db
    .select({
      id: maintenanceRecords.id,
      serviceType: maintenanceRecords.serviceType,
      nextDueDate: maintenanceRecords.nextDueDate,
      nextDueMileage: maintenanceRecords.nextDueMileage,
    })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.vehicleId, vehicleId),
        vehicleInGroup(maintenanceRecords.vehicleId, groupId),
        or(
          isNotNull(maintenanceRecords.nextDueDate),
          isNotNull(maintenanceRecords.nextDueMileage),
        ),
      ),
    );
}

/**
 * Next-due records for the vehicles a profile can see (for garage-grid badges).
 * Joins vehicles so badges match the same shared-OR-owned scope as the grid.
 */
export async function listAllDueRecords(profileId: number) {
  const groupId = await requireGroupId();
  const ownCars = (await canEditProfile(profileId)) ? eq(vehicles.profileId, profileId) : undefined;
  return db
    .select({
      vehicleId: maintenanceRecords.vehicleId,
      nextDueDate: maintenanceRecords.nextDueDate,
      nextDueMileage: maintenanceRecords.nextDueMileage,
    })
    .from(maintenanceRecords)
    .innerJoin(vehicles, eq(maintenanceRecords.vehicleId, vehicles.id))
    .where(
      and(
        eq(vehicles.groupId, groupId),
        or(eq(vehicles.visibility, "shared"), ownCars),
        or(
          isNotNull(maintenanceRecords.nextDueDate),
          isNotNull(maintenanceRecords.nextDueMileage),
        ),
      ),
    );
}
