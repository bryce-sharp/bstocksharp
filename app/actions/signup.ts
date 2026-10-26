"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/session";
import { setActiveProfileCookie } from "@/lib/profile";
import { logEvent } from "@/lib/events";
import { createOwnHub, newLoginError } from "@/lib/own-hub";
import { SIGNUP_APPS, dailyCap, signupsToday, verifyTurnstile } from "@/lib/signup";

// Self sign-up: anyone can make a login, which gets its own games-only hub
// (lib/hub-apps keeps it out of every other app). Runs with NO session, so
// every guard is here: the hidden field, Turnstile, then the daily cap.

export type SignUpState = { error: string } | null;

export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const from = String(formData.get("from") ?? "");

  // People never see the "website" field; a filled one is a form-filling bot.
  if (String(formData.get("website") ?? "")) return { error: "Something went wrong. Try again." };
  const invalid = newLoginError(username, password, confirm);
  if (invalid) return { error: invalid };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(String(formData.get("cf-turnstile-response") ?? ""), ip))) {
    return { error: "We couldn't check that you're a person. Reload the page and try again." };
  }
  if ((await signupsToday()) >= dailyCap()) {
    return { error: "New accounts are full for today. Try again tomorrow." };
  }

  const hub = await createOwnHub(username, password, SIGNUP_APPS);
  if ("error" in hub) return hub;
  await logEvent({ groupId: null, source: "signup", kind: "games_signup", message: `${username} signed up` });

  await createSession(hub.accountId, hub.groupId);
  await setActiveProfileCookie(hub.profileId);
  redirect(from.startsWith("/games") ? from : "/games");
}
