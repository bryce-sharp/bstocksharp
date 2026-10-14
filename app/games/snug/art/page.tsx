import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import { SnugArt } from "@/components/games/snug/SnugClient";
import { getSession } from "@/lib/session";

export const metadata = { title: "Snug art sheet" };

// Signed-in only: the art sheet draws solved quilts, including today's.
export default async function SnugArtPage() {
  if (!(await getSession())) redirect("/login?from=/games/snug/art");
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <SnugArt />
    </Box>
  );
}
