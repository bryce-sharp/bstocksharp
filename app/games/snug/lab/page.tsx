import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import { SnugLab } from "@/components/games/snug/SnugClient";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Snug month lab", robots: { index: false } };

// A testing page, so it sits behind sign-in even though the games around it are public.
export default async function SnugLabPage() {
  if (!(await getSession())) redirect("/login?from=/games/snug/lab");
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <SnugLab />
    </Box>
  );
}
