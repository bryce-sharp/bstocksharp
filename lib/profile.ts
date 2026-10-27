import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { listProfiles } from "@/lib/queries/profiles";
import { getSessionGroupId } from "@/lib/session";
import type { Profile } from "@/lib/db/schema";
import { currentLogin } from "@/lib/hub-apps";

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE PROFILE — who "we" are across the hub.
//
// Profiles (the household's people) live in `workout_profiles`, but the *active*
// one is a hub-wide preference, not workout data — so it rides in a cookie that
// any server component can read. This is the single source of truth; a `?profile`
// URL param, when present, is only a per-request override (deep links, sharing).
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_PROFILE_COOKIE = "active_profile";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — it's a preference, not a token

/**
 * The active profile. Precedence: a valid `override` (e.g. a `?profile=` param)
 * → the cookie → the first profile. Null only when no profiles exist at all.
 */
export async function getActiveProfile(
  override?: string | number | null,
): Promise<Profile | null> {
  // Signed out (login page shell, manifest, icon routes) → neutral identity.
  // Deliberate: pre-login surfaces must leak no profile names or colors.
  if ((await getSessionGroupId()) === null) return null;

  const profiles = await listProfiles(); // group-scoped (lib/queries/profiles)
  if (profiles.length === 0) return null;

  const pick = (raw: string | number | null | undefined) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const id = Number(raw);
    return Number.isNaN(id) ? null : (profiles.find((p) => p.id === id) ?? null);
  };

  const fromOverride = pick(override);
  if (fromOverride) return fromOverride;

  const fromCookie = pick((await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value);
  return fromCookie ?? profiles[0];
}

/** Persist the active profile. Call from a Server Action (cookies are writable there). */
export async function setActiveProfileCookie(id: number): Promise<void> {
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * You: the person the signed-in login is tied to. The header, the app's name,
 * color and icons follow this, never the person being viewed. Null for the shared
 * login and for a login tied to no one.
 */
export const getMe = cache(async (): Promise<Profile | null> => {
  if ((await getSessionGroupId()) === null) return null;
  const id = (await currentLogin())?.profileId ?? null;
  if (id === null) return null;
  return (await listProfiles()).find((p) => p.id === id) ?? null;
});
