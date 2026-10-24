import type { Metadata } from "next";
import Box from "@mui/material/Box";
import { ReturnToSenderGame } from "@/components/games/return-to-sender/Client";

// Unlisted while it is being tested: it is not in the games gallery, and search engines are asked to skip it.
export const metadata: Metadata = { title: "Return to Sender", robots: { index: false } };

export default function ReturnToSenderPage() {
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <ReturnToSenderGame />
    </Box>
  );
}
