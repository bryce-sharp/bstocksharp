import type { Metadata, Viewport } from "next";
import Box from "@mui/material/Box";
import { SnugGame } from "@/components/games/snug/SnugClient";
import { LINEN } from "@/components/games/snug/palette";
import { getGame } from "@/lib/games";
import { getActiveProfile } from "@/lib/profile";
import { canEditProfile } from "@/lib/auth";
import PrivateNotice from "@/components/shared/PrivateNotice";

const snug = getGame("snug")!;

// Snug's own name, icon and app setting, so saving it to a home screen makes a Snug app rather than the hub.
export const metadata: Metadata = {
  title: snug.name,
  description: snug.tagline,
  openGraph: { title: snug.name, description: snug.tagline, images: [snug.image] },
  manifest: "/games/snug/manifest.webmanifest",
  icons: { icon: "/games/snug/app-icon?size=64", apple: "/games/snug/app-icon?size=180" },
  appleWebApp: { capable: true, title: snug.name, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: LINEN };

// Signed-in players save to their account; everyone else plays on this device only. A person with
// their own login plays there, so other logins cannot play for them or see their boards.
export default async function SnugPage() {
  const active = await getActiveProfile();
  if (active && !(await canEditProfile(active.id))) {
    return (
      <PrivateNotice
        title={`You can't play Snug for ${active.name} or see their boards`}
        detail={`${active.name} plays on their own login. Pick yourself, or someone without a login, under Viewing at the top.`}
      />
    );
  }
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      {/* A new person gets a fresh board, loaded from their own saves. */}
      <SnugGame key={active?.id ?? "guest"} profileId={active?.id} />
    </Box>
  );
}
