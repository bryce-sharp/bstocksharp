import "server-only";
import { cache } from "react";
import { getProfile } from "@/lib/queries/profiles";
import { currentLogin } from "@/lib/hub-apps";
import { listGroupMembers } from "@/lib/queries/groups";
import type { Profile } from "@/lib/db/schema";

// Who can see a person's data in a personal app (lib/apps `personal`). Each
// person picks per app: everyone in the hub (the default), chosen people, or
// just them. It holds against the hub owner too. The hub's shared login sees
// what is shared with everyone, plus what lists it among chosen people;
// a login tied to no one sees only what is shared with everyone. People without
// a login have no sharing at all: the whole hub sees their stuff.

/** Who is looking: the person a login is tied to, or the hub's shared login. */
export type Looker = { profileId: number | null; isHubLogin: boolean };

/**
 * Does this person's sharing let this login see their data in this app? A
 * person without a login of their own has no sharing: everyone in the hub sees
 * their stuff, until they get a login and choose for themselves.
 */
export function allows(
  profile: Pick<Profile, "id" | "sharing">,
  app: string,
  looker: Looker,
  hasLogin: boolean,
): boolean {
  if (!hasLogin) return true;
  const rule = profile.sharing[app];
  if (!rule || rule.who === "everyone") return true;
  if (looker.isHubLogin) return rule.who === "chosen" && rule.hub === true;
  if (looker.profileId === profile.id) return true;
  return rule.who === "chosen" && looker.profileId !== null && (rule.people ?? []).includes(looker.profileId);
}

/** The people in this hub who have a login of their own. */
export const peopleWithOwnLogin = cache(async (): Promise<Set<number>> => {
  const members = await listGroupMembers();
  return new Set(members.flatMap((m) => (m.profileId === null ? [] : [m.profileId])));
});

/** Can the signed-in login see this person's data in this app? */
export async function canView(profile: Pick<Profile, "id" | "sharing">, app: string): Promise<boolean> {
  const [login, owned] = await Promise.all([currentLogin(), peopleWithOwnLogin()]);
  return allows(
    profile,
    app,
    { profileId: login?.profileId ?? null, isHubLogin: login?.isHubLogin ?? false },
    owned.has(profile.id),
  );
}

const viewable = cache(async (profileId: number, app: string) => {
  const profile = await getProfile(profileId);
  return !!profile && (await canView(profile, app));
});

/** Guard for reads and writes of one person's data: throws unless the login may see it. */
export async function requireView(profileId: number, app: string): Promise<void> {
  if (!(await viewable(profileId, app))) throw new Error("This person keeps that private.");
}
