"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

// The "Today" fast-track. The weekday must come from the phone's clock — the
// server runs in UTC and would resolve the wrong day for an evening workout — so
// we pick it here on the client and redirect: straight to the run if today has a
// workout, otherwise to today's day page (rest day / setup).
export default function TodayRedirect({
  workoutByDay,
  profileId,
}: {
  workoutByDay: Record<number, number>;
  profileId: number;
}) {
  const router = useRouter();

  React.useEffect(() => {
    const wd = new Date().getDay();
    const workoutId = workoutByDay[wd];
    router.replace(
      workoutId != null
        ? `/workout/${workoutId}/run`
        : `/workout/day/${wd}?profile=${profileId}`,
    );
  }, [workoutByDay, profileId, router]);

  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography sx={{ color: "text.secondary" }}>
        Finding today&apos;s workout…
      </Typography>
    </Box>
  );
}
