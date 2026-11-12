import { listProfiles } from "@/lib/queries/profiles";
import { listGroupMembers } from "@/lib/queries/groups";
import { getActiveProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { getApp } from "@/lib/apps";
import { canView } from "@/lib/sharing";
import type { ViewingPick } from "./ViewingMenu";

// The apps whose pages show one person's stuff, so they get a Viewing picker.
export const VIEWING_APPS = ["weight", "workout", "games", "garage", "recipes"];

export type Viewing = { active: ViewingPick; people: ViewingPick[] };

// Whose stuff this app shows, and who else could be picked; null when there is no one else to pick. People another
// login holds are marked with a lock, and people whose sharing leaves you out are marked "private here".
export async function loadViewing(app: string): Promise<Viewing | null> {
  if (!VIEWING_APPS.includes(app)) return null;
  const [profiles, active, members, session] = await Promise.all([
    listProfiles(),
    getActiveProfile(),
    listGroupMembers(),
    getSession(),
  ]);
  if (!active || profiles.length < 2) return null;

  const lockedBy = new Map<number, string>();
  for (const m of members) {
    if (m.profileId != null && m.id !== session?.accountId) lockedBy.set(m.profileId, m.username);
  }
  const personal = getApp(app)?.personal ? app : null;
  const hidden = new Set<number>();
  for (const p of profiles) if (personal && !(await canView(p, personal))) hidden.add(p.id);

  const pick = (p: { id: number; name: string; color: string | null }): ViewingPick => ({
    id: p.id,
    name: p.name,
    color: p.color,
    lockedBy: lockedBy.get(p.id) ?? null,
    you: members.some((m) => m.id === session?.accountId && m.profileId === p.id),
    private: hidden.has(p.id),
  });

  return { active: pick(active), people: profiles.map(pick) };
}
