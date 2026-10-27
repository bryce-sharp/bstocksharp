"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  attachments,
  groups,
  invites,
  journalEntries,
  maintenanceRecords,
  profiles,
  vehicles,
  wishlistItems,
  workouts,
} from "@/lib/db/schema";
import { destroySession, requireSession } from "@/lib/session";
import { claimedBy, hashPassword, isSiteAdmin, requireEditor, requireOwner } from "@/lib/auth";
import { allHubApps, currentLogin } from "@/lib/hub-apps";
import { newLoginError } from "@/lib/own-hub";
import { getProfile } from "@/lib/queries/profiles";

// Claims are SELF-service: an account claims a profile for itself ("I am this
// person") — nobody claims on someone else's behalf. Membership is OWNER
// business (Phase E): the owner mints/revokes invite links and removes logins;
// requireOwner() gates all three. The create-account script still works as the
// break-glass path.

/** Claim a profile as the signed-in account ("this login is this person"). */
export async function claimProfileAction(
  profileId: number,
  _formData: FormData,
): Promise<void> {
  const { accountId } = await requireSession();
  if ((await currentLogin())?.isHubLogin) throw new Error("The hub login is no particular person.");

  const profile = await getProfile(profileId); // group-scoped
  if (!profile) throw new Error("Profile not found.");
  const owner = await claimedBy(profileId);
  if (owner !== null && owner !== accountId) {
    throw new Error("That profile is already claimed by another account.");
  }

  // Re-claiming moves YOUR claim (an account claims at most one profile).
  await db
    .update(accounts)
    .set({ profileId })
    .where(eq(accounts.id, accountId));

  revalidatePath("/group");
  revalidatePath("/", "layout");
}

/** Release the signed-in account's claim (the profile becomes open again). */
export async function releaseClaimAction(_formData: FormData): Promise<void> {
  const { accountId } = await requireSession();
  await db
    .update(accounts)
    .set({ profileId: null })
    .where(and(eq(accounts.id, accountId)));

  revalidatePath("/group");
  revalidatePath("/", "layout");
}

// ── The hub login and login limits ─────────────────────────────────────────────

export type LoginFormState = { error: string } | { ok: true } | null;

/** The chosen app slugs from a form, kept to the hub's own apps; null = all of them. */
async function chosenApps(formData: FormData): Promise<string[] | null | { error: string }> {
  const hub = await allHubApps();
  const picked = formData.getAll("apps").map(String).filter((slug) => hub.includes(slug));
  if (picked.length === 0) return { error: "Pick at least one app." };
  return picked.length === hub.length ? null : picked;
}

/**
 * Make the hub login: one shared login that is no particular person (a
 * kitchen screen), limited to the apps chosen. Owner only, one per hub.
 */
export async function createHubLoginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const session = await requireOwner();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const invalid = newLoginError(username, password, String(formData.get("confirm") ?? ""));
  if (invalid) return { error: invalid };
  const apps = await chosenApps(formData);
  if (apps && "error" in apps) return apps;

  try {
    await db.insert(accounts).values({
      username,
      passwordHash: hashPassword(password),
      groupId: session.groupId,
      apps,
      isHubLogin: true,
    });
  } catch {
    // The username index or the one-hub-login-per-hub index refused it.
    return { error: "That username is taken, or this hub already has a hub login." };
  }
  revalidatePath("/group");
  return { ok: true };
}

/** The owner sets the hub login's password; every device signed in with it signs out. */
export async function setHubLoginPasswordAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const session = await requireOwner();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const updated = await db
    .update(accounts)
    .set({ passwordHash: hashPassword(password), passwordChangedAt: new Date() })
    .where(and(eq(accounts.groupId, session.groupId), eq(accounts.isHubLogin, true)))
    .returning({ id: accounts.id });
  if (!updated.length) return { error: "This hub has no hub login." };
  revalidatePath("/group");
  return { ok: true };
}

/** The owner limits which of the hub's apps another login may open. */
export async function setLoginAppsAction(
  accountId: number,
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const session = await requireOwner();
  if (accountId === session.accountId) return { error: "You can't limit your own login." };
  const apps = await chosenApps(formData);
  if (apps && "error" in apps) return apps;
  const updated = await db
    .update(accounts)
    .set({ apps })
    .where(and(eq(accounts.id, accountId), eq(accounts.groupId, session.groupId)))
    .returning({ id: accounts.id });
  if (!updated.length) return { error: "That login isn't in this hub." };
  revalidatePath("/group");
  return { ok: true };
}

// ── Invites (Phase E) ─────────────────────────────────────────────────────────

const INVITE_TTL_DAYS = 7;

export type CreateInviteState =
  | { token: string; household: boolean; reusable: boolean }
  | { error: string }
  | null;

/**
 * Mint an invite link (useActionState). `destination` picks where the new login
 * lands: "household" = this group (they see everything); "own-hub" = a fresh
 * empty hub of their own. Single-use unless `reusable`; always expires in
 * 7 days. Returns the token — the client shows the full /join URL to copy.
 */
export async function createInviteAction(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const session = await requireOwner();

  const household = String(formData.get("destination") ?? "household") !== "own-hub";
  // Owners invite people into their own hub; only a site admin starts someone a new hub.
  if (!household && !(await isSiteAdmin())) {
    return { error: "Only a site admin can give someone their own hub." };
  }
  const reusable = formData.get("reusable") != null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 120) || null;

  // Paranoia belt: requireOwner already fails on the demo group (its owner is
  // null), but a demo invite would be nonsense — the group wipes on every tour.
  const [group] = await db
    .select({ isDemo: groups.isDemo })
    .from(groups)
    .where(eq(groups.id, session.groupId))
    .limit(1);
  if (!group || group.isDemo) return { error: "This group can't mint invites." };

  const token = randomBytes(24).toString("base64url"); // 32 chars, unguessable
  await db.insert(invites).values({
    token,
    groupId: household ? session.groupId : null,
    createdByAccountId: session.accountId,
    note,
    maxUses: reusable ? null : 1,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  revalidatePath("/group");
  return { token, household, reusable };
}

export type PersonInviteState = { token: string } | { error: string };

/**
 * A sign-in link for one person in this hub: whoever opens it makes a login
 * that IS that person. Owner-only, like every invite; the person must not have
 * a login yet. A live link for them is reused rather than minting another.
 */
export async function inviteToPersonAction(profileId: number): Promise<PersonInviteState> {
  const session = await requireOwner();
  const [person] = await db
    .select({ id: profiles.id, archivedAt: profiles.archivedAt, isDemo: groups.isDemo })
    .from(profiles)
    .innerJoin(groups, eq(profiles.groupId, groups.id))
    .where(and(eq(profiles.id, profileId), eq(profiles.groupId, session.groupId)))
    .limit(1);
  if (!person || person.isDemo || person.archivedAt) {
    return { error: "This person can't get a sign-in link." };
  }
  if (await claimedBy(profileId)) return { error: "This person already has a login." };

  const [live] = await db
    .select({ token: invites.token })
    .from(invites)
    .where(
      and(
        eq(invites.profileId, profileId),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date()),
        lt(invites.usedCount, 1),
      ),
    )
    .limit(1);
  if (live) return { token: live.token };

  const token = randomBytes(24).toString("base64url");
  await db.insert(invites).values({
    token,
    groupId: session.groupId,
    profileId,
    createdByAccountId: session.accountId,
    maxUses: 1,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  revalidatePath("/group");
  return { token };
}

/** Kill a live invite link (the row stays as audit trail). */
export async function revokeInviteAction(
  inviteId: number,
  _formData: FormData,
): Promise<void> {
  const session = await requireOwner();
  // Scope: only invites minted by THIS group's accounts (bound update).
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invites.id, inviteId),
        inArray(
          invites.createdByAccountId,
          db
            .select({ id: accounts.id })
            .from(accounts)
            .where(eq(accounts.groupId, session.groupId)),
        ),
      ),
    );
  revalidatePath("/group");
}

// ── Member removal (Phase E) ──────────────────────────────────────────────────

/**
 * Remove a LOGIN from the group. The person and all their data stay — deleting
 * the account row releases its claim (the profile becomes open) and cascades
 * only to the login's own passkeys. Their session cookie dies at the next
 * request via the liveness check in lib/session.
 */
export async function removeMemberAction(
  accountId: number,
  _formData: FormData,
): Promise<void> {
  const session = await requireOwner();
  if (accountId === session.accountId) {
    throw new Error("You can't remove your own login — you're the owner.");
  }
  // Bound delete: a foreign account id is a no-op, not a cross-group kick.
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.groupId, session.groupId)));

  revalidatePath("/group");
}

// ── Lifecycle (Phase E close-out): leave / transfer / delete forever ──────────

/**
 * Leave the hub: delete YOUR OWN login (and its passkeys, via cascade). The
 * person and their data stay — leaving is the mirror of being removed. Self-
 * service like claims (it's your login; the dialog confirms).
 * The owner can't leave — transfer ownership first, or delete the hub.
 */
export async function leaveHubAction(_formData: FormData): Promise<void> {
  const session = await requireSession();
  const [group] = await db
    .select({ ownerAccountId: groups.ownerAccountId, isDemo: groups.isDemo })
    .from(groups)
    .where(eq(groups.id, session.groupId))
    .limit(1);
  // A demo visitor "leaving" would delete the SHARED demo login mid-tour.
  if (!group || group.isDemo) throw new Error("The demo hub can't be left.");
  if (group.ownerAccountId === session.accountId) {
    throw new Error(
      "You're the owner — transfer ownership first (or delete the hub).",
    );
  }

  await db.delete(accounts).where(eq(accounts.id, session.accountId));
  await destroySession();
  redirect("/login");
}

/** Hand the owner role to another member (they gain invites/removal; you keep everything else). */
export async function transferOwnershipAction(formData: FormData): Promise<void> {
  const session = await requireOwner();
  const newOwnerId = Number(formData.get("newOwnerId"));
  if (!Number.isInteger(newOwnerId) || newOwnerId === session.accountId) {
    throw new Error("Pick another member to hand the keys to.");
  }
  // The new owner must be a login in THIS group (bound check).
  const [target] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, newOwnerId), eq(accounts.groupId, session.groupId)))
    .limit(1);
  if (!target) throw new Error("That login isn't a member of this hub.");

  await db
    .update(groups)
    .set({ ownerAccountId: newOwnerId })
    .where(eq(groups.id, session.groupId));
  revalidatePath("/group");
}

/** Deletes a hub and everything in it, in the order the comment on deleteHubAction explains. */
async function eraseHub(groupId: number): Promise<void> {
  const groupVehicles = db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.groupId, groupId));
  await db
    .delete(attachments)
    .where(
      or(
        and(eq(attachments.ownerType, "vehicle"), inArray(attachments.ownerId, groupVehicles)),
        and(
          eq(attachments.ownerType, "maintenance"),
          inArray(
            attachments.ownerId,
            db
              .select({ id: maintenanceRecords.id })
              .from(maintenanceRecords)
              .where(inArray(maintenanceRecords.vehicleId, groupVehicles)),
          ),
        ),
        and(
          eq(attachments.ownerType, "journal"),
          inArray(
            attachments.ownerId,
            db
              .select({ id: journalEntries.id })
              .from(journalEntries)
              .where(inArray(journalEntries.vehicleId, groupVehicles)),
          ),
        ),
        and(
          eq(attachments.ownerType, "wishlist"),
          inArray(
            attachments.ownerId,
            db
              .select({ id: wishlistItems.id })
              .from(wishlistItems)
              .where(inArray(wishlistItems.vehicleId, groupVehicles)),
          ),
        ),
      ),
    );

  await db.delete(workouts).where(
    inArray(
      workouts.createdByProfileId,
      db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.groupId, groupId)),
    ),
  );

  await db.delete(groups).where(eq(groups.id, groupId));
}

/**
 * Delete the WHOLE hub, forever: every person, car, workout, weigh-in, login
 * and invite. Owner-only, and the form must echo the hub's exact name back
 * (the type-the-name ritual). Deletion order matters:
 *   1. attachment rows — polymorphic (no FK), they'd survive the cascade;
 *   2. workouts — `ON DELETE RESTRICT` behind profiles (the guard that stops a
 *      profile delete nuking shared routines) would abort the group cascade;
 *   3. the group row — everything else cascades off it (accounts→passkeys+
 *      invites, profiles→weight data, vehicles→records/fuel/parts/journal…).
 * Other members' sessions die at their next request (liveness check).
 */
export async function deleteHubAction(formData: FormData): Promise<void> {
  const session = await requireOwner();
  const [group] = await db
    .select({ name: groups.name, isDemo: groups.isDemo })
    .from(groups)
    .where(eq(groups.id, session.groupId))
    .limit(1);
  if (!group || group.isDemo) throw new Error("This hub can't be deleted.");

  const typed = String(formData.get("confirm") ?? "").trim();
  if (typed !== group.name) {
    throw new Error("The name you typed doesn't match this hub's name.");
  }

  await eraseHub(session.groupId);
  await destroySession();
  redirect("/login");
}

/**
 * Delete your own account when you are the only login in your hub (a games
 * sign-up, say): the hub and everything in it go with it. The form must echo
 * your username. Anyone sharing a hub leaves or hands it over on /group instead.
 */
export async function deleteMyAccountAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  const [me] = await db
    .select({
      username: accounts.username,
      ownerAccountId: groups.ownerAccountId,
      isDemo: groups.isDemo,
    })
    .from(accounts)
    .innerJoin(groups, eq(accounts.groupId, groups.id))
    .where(eq(accounts.id, session.accountId))
    .limit(1);
  if (!me || me.isDemo || me.ownerAccountId !== session.accountId) {
    throw new Error("Only the owner of a hub of one can delete their account here.");
  }
  const others = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.groupId, session.groupId));
  if (others.length !== 1) throw new Error("Others share this hub; hand it over in Hub settings first.");
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== me.username) {
    throw new Error("The username you typed doesn't match.");
  }

  await eraseHub(session.groupId);
  await destroySession();
  redirect("/games");
}

/** Rename the household (shown on /group and in invite greetings). */
export async function renameGroupAction(formData: FormData): Promise<void> {
  await requireEditor();
  const { groupId } = await requireSession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) throw new Error("Group name is required.");

  await db.update(groups).set({ name }).where(eq(groups.id, groupId));
  revalidatePath("/group");
}

/** A real IANA timezone? Intl throws on garbage — cheap, correct validation. */
function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Set the household timezone — pins the finance app's "today" (see parse.ts). */
export async function updateGroupTimezoneAction(formData: FormData): Promise<void> {
  await requireEditor();
  const { groupId } = await requireSession();
  const tz = String(formData.get("timezone") ?? "").trim().slice(0, 64);
  if (!tz || !isValidTimeZone(tz)) throw new Error("Pick a valid timezone.");

  await db.update(groups).set({ timezone: tz }).where(eq(groups.id, groupId));
  revalidatePath("/group");
  revalidatePath("/finance"); // budget/atlas recompute their "current month"
}
