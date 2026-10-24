import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import { ReturnToSenderLab } from "@/components/games/return-to-sender/Client";
import type { MonthFile } from "@/components/games/return-to-sender/schedule";
import { MONTH_FILES } from "@/data/return-to-sender/months";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Return to Sender lab", robots: { index: false } };

// A testing page, so it sits behind sign-in, and it sees every generated day, future ones included.
export default async function ReturnToSenderLabPage() {
  if (!(await getSession())) redirect("/login?from=/games/return-to-sender/lab");
  const months = await Promise.all(Object.values(MONTH_FILES).map(async (load) => (await load()).default as MonthFile));
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 }, pt: { xs: 3, md: 4 }, pb: 2.5 }}>
      <ReturnToSenderLab months={months} />
    </Box>
  );
}
