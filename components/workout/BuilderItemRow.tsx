"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Collapse from "@mui/material/Collapse";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import {
  moveWorkoutItem,
  removeWorkoutItem,
  updateWorkoutItem,
} from "@/app/actions/workout";
import { formatTarget, type ResolvedItem } from "@/lib/workout";
import type { WorkoutItem, Exercise } from "@/lib/db/schema";
import Chip from "@mui/material/Chip";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import WorkoutItemAutoSave from "@/components/workout/WorkoutItemAutoSave";

// A builder row: summary + reorder + delete, with an inline (accordion) edit
// form that opens below on the same page and closes itself after Save.
export default function BuilderItemRow({
  resolved: it,
  item,
  exercise,
  workoutId,
  itemId,
  isFirst,
  isLast,
}: {
  resolved: ResolvedItem;
  item: WorkoutItem;
  exercise: Exercise;
  workoutId: number;
  itemId: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const arrowSx = { border: 1, borderColor: "divider", borderRadius: 1.5 };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
        <Stack sx={{ flexShrink: 0 }} spacing={0.75}>
          <form action={moveWorkoutItem.bind(null, itemId, workoutId, "up")}>
            <IconButton type="submit" aria-label="Move up" disabled={isFirst} sx={arrowSx}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
          </form>
          <form action={moveWorkoutItem.bind(null, itemId, workoutId, "down")}>
            <IconButton type="submit" aria-label="Move down" disabled={isLast} sx={arrowSx}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
          </form>
        </Stack>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {it.name}
            </Typography>
            <Chip
              icon={
                it.mode === "timed" ? (
                  <TimerOutlinedIcon />
                ) : (
                  <RepeatOutlinedIcon />
                )
              }
              label={formatTarget(it)}
            />
            {it.weight ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {it.weight}
              </Typography>
            ) : null}
          </Stack>
          {it.note ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {it.note}
            </Typography>
          ) : null}
        </Box>

        <Tooltip title={open ? "Close" : "Edit"}>
          <IconButton
            onClick={() => setOpen((o) => !o)}
            size="small"
            aria-label={`Edit ${it.name}`}
            color={open ? "primary" : "default"}
            sx={{ flexShrink: 0 }}
          >
            {open ? <CloseIcon fontSize="small" /> : <EditOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <DeleteIconButton
          action={removeWorkoutItem.bind(null, itemId, workoutId)}
          confirmMessage={`Remove ${it.name} from this workout?`}
          label={`Remove ${it.name}`}
        />
      </Stack>

      <Collapse in={open}>
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <WorkoutItemAutoSave
            action={updateWorkoutItem.bind(null, itemId, workoutId)}
            item={item}
            exercise={exercise}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}
