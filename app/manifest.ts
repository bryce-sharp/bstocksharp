import type { MetadataRoute } from "next";
import { getMe } from "@/lib/profile";
import { getHubName } from "@/lib/queries/group";

// Web app manifest → makes the hub installable ("Add to Home Screen") and run
// standalone. Name + accent follow the ACTIVE profile, so an install is
// personalized (captured at install time, like the icon — not live). Icons are
// generated PNGs from /manifest-icon (profile color + initial — same family as
// apple-icon/profile-icon): PNG at 192/512 is what Android/Chrome installability
// expects, and the maskable variant keeps the glyph inside the crop-safe zone.
// NOTE: proxy.ts (the login gate) must keep /manifest.webmanifest and
// /manifest-icon on its allowlist, or installs break when logged out.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const me = await getMe();
  const who = me?.name ?? (await getHubName()) ?? "Hub";

  return {
    id: "/",
    name: who,
    short_name: who,
    description:
      "A personal hub of small apps — a garage tracker, the Miata Bible, and a workout companion.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e1214",
    theme_color: me?.color ?? "#4caf7d",
    icons: [
      { src: "/manifest-icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/manifest-icon?size=512", sizes: "512x512", type: "image/png" },
      {
        src: "/manifest-icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
