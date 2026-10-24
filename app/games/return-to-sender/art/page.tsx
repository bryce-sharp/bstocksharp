import type { Metadata } from "next";
import Box from "@mui/material/Box";
import { ReturnToSenderArt } from "@/components/games/return-to-sender/Client";

export const metadata: Metadata = { title: "Return to Sender art sheet", robots: { index: false } };

// Every look being considered, for review. Its sample puzzle is made up, so it spoils nothing and stays public, like Snug's.
export default function ReturnToSenderArtPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <ReturnToSenderArt />
    </Box>
  );
}
