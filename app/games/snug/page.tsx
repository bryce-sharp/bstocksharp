import type { Metadata } from "next";
import Box from "@mui/material/Box";
import { SnugGame } from "@/components/games/snug/SnugClient";
import { getGame } from "@/lib/games";

const snug = getGame("snug")!;

export const metadata: Metadata = {
  title: snug.name,
  description: snug.tagline,
  openGraph: { title: snug.name, description: snug.tagline, images: [snug.image] },
};

export default function SnugPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <SnugGame />
    </Box>
  );
}
