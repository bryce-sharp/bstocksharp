import type { Metadata, Viewport } from "next";
import Box from "@mui/material/Box";
import { SnugGame } from "@/components/games/snug/SnugClient";
import { LINEN } from "@/components/games/snug/palette";
import { getGame } from "@/lib/games";
import { getActiveProfile } from "@/lib/profile";

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

// Signed-in players save to their account; everyone else plays on this device only.
export default async function SnugPage() {
  const active = await getActiveProfile();
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <SnugGame profileId={active?.id} />
    </Box>
  );
}
