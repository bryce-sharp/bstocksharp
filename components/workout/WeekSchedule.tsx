"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { WEEKDAYS } from "@/lib/workout";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";

type Assignment = {
  weekday: number;
  workoutId: number;
  workoutName: string;
  rounds: number;
};

// Mon-first display order (JS getDay(): 0=Sun … 6=Sat).
const ORDER = [1, 2, 3, 4, 5, 6, 0];

// Client component so "today" uses the phone's clock, not the server's UTC day.
export default function WeekSchedule({
  assignments,
  profileName,
  profileId,
  editor,
}: {
  assignments: Assignment[];
  profileName: string;
  profileId: number;
  editor: boolean;
}) {
  const [today, setToday] = React.useState<number | null>(null);
  React.useEffect(() => setToday(new Date().getDay()), []);

  const byDay = new Map(assignments.map((a) => [a.weekday, a]));
  const todayA = today != null ? (byDay.get(today) ?? null) : null;

  return (
    <Box>
      {/* Today banner (only once we know the client's weekday) */}
      {today != null ? (
        <Paper
          variant="outlined"
          sx={{ p: 2.5, mb: 4, borderColor: "primary.main" }}
        >
          <Typography variant="overline" sx={{ color: "text.secondary" }}>
            Today · {WEEKDAYS[today].label}
          </Typography>
          {todayA ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{ justifyContent: "space-between", alignItems: "center", mt: 0.5 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6">{todayA.workoutName}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {todayA.rounds > 1
                    ? `${todayA.rounds} rounds`
                    : "Ready when you are."}
                </Typography>
              </Box>
              <Button
                component={Link}
                href={`/workout/${todayA.workoutId}/run`}
                variant="contained"
                startIcon={<PlayArrowIcon />}
                sx={{ flexShrink: 0 }}
              >
                Start
              </Button>
            </Stack>
          ) : (
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: "center", mt: 0.5 }}
            >
              <Typography sx={{ color: "text.secondary" }}>
                Rest day — nothing scheduled. 💤
              </Typography>
              <Button
                component={Link}
                href={`/workout/day/${today}?profile=${profileId}`}
                size="small"
                sx={{ flexShrink: 0 }}
              >
                Set up
              </Button>
            </Stack>
          )}
        </Paper>
      ) : null}

      {/* The week */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", mb: 1.5 }}
      >
        <Typography variant="h5" component="h2">
          {profileName}&apos;s week
        </Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/workout/schedule?profile=${profileId}`}
            startIcon={<EditCalendarIcon />}
            size="small"
            sx={{ mt: 1.5 }}
          >
            Edit schedule
          </Button>
        ) : null}
      </Stack>
      <Stack spacing={1}>
        {ORDER.map((d) => {
          const a = byDay.get(d);
          const isToday = d === today;
          return (
            <Paper
              key={d}
              variant="outlined"
              sx={{
                p: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 2,
                ...(isToday ? { borderColor: "primary.main" } : null),
              }}
            >
              <Typography
                sx={{
                  width: 44,
                  flexShrink: 0,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? "primary.main" : "text.secondary",
                }}
              >
                {WEEKDAYS[d].short}
              </Typography>
              {a ? (
                <MuiLink
                  component={Link}
                  href={`/workout/${a.workoutId}`}
                  underline="hover"
                  color="inherit"
                  sx={{ flexGrow: 1, minWidth: 0, fontWeight: 500 }}
                >
                  {a.workoutName}
                </MuiLink>
              ) : (
                <MuiLink
                  component={Link}
                  href={`/workout/day/${d}?profile=${profileId}`}
                  underline="hover"
                  sx={{
                    color: "text.secondary",
                    flexGrow: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.25,
                  }}
                >
                  Rest <ChevronRightIcon fontSize="small" />
                </MuiLink>
              )}
              {a ? (
                <Chip
                  size="small"
                  icon={<PlayArrowIcon />}
                  label="Start"
                  clickable
                  component={Link}
                  href={`/workout/${a.workoutId}/run`}
                  color={isToday ? "primary" : "default"}
                  variant={isToday ? "filled" : "outlined"}
                />
              ) : null}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
