import "server-only";
import { cache } from "react";
import { getProfile } from "@/lib/queries/profiles";
import { currentLogin } from "@/lib/hub-apps";
import type { Profile } from "@/lib/db/schema";

// Who can see a person's data in a personal app (lib/apps `personal`). Each
// person picks per app: everyone in the hub (the default), chosen people, or
// just them. It holds against the hub owner too. A login with no person (the
// hub login, an unlinked login) sees only what is shared with everyone.

/** Can the signed-in login see this person's data in this app? */
export async function canView(
  profile: Pick<Profile, "id" | "sharing">,
  app: string,
): Promise<boolean> {
  const rule = profile.sharing[app];
  if (!rule || rule.who === "everyone") return true;
  const viewer = (await currentLogin())?.profileId ?? null;
  if (viewer === profile.id) return true;
  return rule.who === "chosen" && viewer !== null && (rule.people ?? []).includes(viewer);
}

const viewable = cache(async (profileId: number, app: string) => {
  const profile = await getProfile(profileId);
  return !!profile && (await canView(profile, app));
});

/** Guard for reads and writes of one person's data: throws unless the login may see it. */
export async function requireView(profileId: number, app: string): Promise<void> {
  if (!(await viewable(profileId, app))) throw new Error("This person keeps that private.");
}
