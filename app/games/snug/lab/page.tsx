import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import { SnugLab } from "@/components/games/snug/SnugClient";
import { isDevSite } from "@/lib/dev";

export const metadata: Metadata = { title: "Snug month lab", robots: { index: false } };

// A dev page (lib/dev): only on your own machine.
export default function SnugLabPage() {
  if (!isDevSite) notFound();
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <SnugLab />
    </Box>
  );
}
