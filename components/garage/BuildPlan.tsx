"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import LinearProgress from "@mui/material/LinearProgress";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { toggleBuildTask, deleteBuildTask } from "@/app/actions/build";
import { PHASES } from "@/lib/build";
import { formatMoney } from "@/lib/format";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import type { BuildTask } from "@/lib/db/schema";

function pct(done: number, total: number) {
  return total > 0 ? (done / total) * 100 : 0;
}

export default function BuildPlan({
  tasks,
  vehicleId,
  editor,
}: {
  tasks: BuildTask[];
  vehicleId: number;
  editor: boolean;
}) {
  // Optimistic state: flipping a checkbox updates the list (and the progress
  // bars) instantly; the server catches up and revalidation resets to truth.
  const [optimisticTasks, applyOptimistic] = React.useOptimistic(
    tasks,
    (state, update: { id: number; done: boolean }) =>
      state.map((t) =>
        t.id === update.id
          ? { ...t, status: update.done ? "done" : "planned" }
          : t,
      ),
  );
  const [, startTransition] = React.useTransition();

  function toggle(task: BuildTask) {
    const done = task.status !== "done";
    startTransition(async () => {
      applyOptimistic({ id: task.id, done });
      await toggleBuildTask(task.id, vehicleId, done);
    });
  }

  const doneCount = optimisticTasks.filter((t) => t.status === "done").length;
  const total = optimisticTasks.length;

  const groups = [
    ...PHASES.map((p) => ({
      key: String(p.num),
      name: `${p.num}. ${p.name}`,
      tasks: optimisticTasks.filter((t) => t.phase === p.num),
    })),
    {
      key: "general",
      name: "General",
      tasks: optimisticTasks.filter((t) => t.phase == null),
    },
  ].filter((g) => g.tasks.length > 0);

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle2">Overall progress</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {doneCount}/{total} done
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct(doneCount, total)}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Paper>

      <Stack spacing={2.5}>
        {groups.map((g) => {
          const gDone = g.tasks.filter((t) => t.status === "done").length;
          return (
            <Box key={g.key}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {g.name}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {gDone}/{g.tasks.length}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct(gDone, g.tasks.length)}
                sx={{ height: 6, borderRadius: 1, my: 1 }}
              />
              <Stack spacing={1}>
                {g.tasks.map((t) => {
                  const done = t.status === "done";
                  return (
                    <Paper key={t.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" sx={{ alignItems: "flex-start" }} spacing={1}>
                        <Checkbox
                          checked={done}
                          onChange={() => toggle(t)}
                          disabled={!editor}
                          sx={{ p: 0.5, mt: "-2px" }}
                          slotProps={{ input: { "aria-label": `Mark ${t.title} done` } }}
                        />
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography
                              variant="body1"
                              sx={{
                                fontWeight: 600,
                                textDecoration: done ? "line-through" : "none",
                                color: done ? "text.secondary" : "text.primary",
                              }}
                            >
                              {t.title}
                            </Typography>
                            {t.status === "in_progress" ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="warning"
                                label="in progress"
                              />
                            ) : null}
                            {t.priority === "high" ? (
                              <Chip
                                size="small"
                                variant="outlined"
                                color="error"
                                label="high"
                              />
                            ) : null}
                            {t.costEstimate ? (
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                {formatMoney(t.costEstimate)}
                              </Typography>
                            ) : null}
                          </Stack>
                          {t.description ? (
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}
                            >
                              {t.description}
                            </Typography>
                          ) : null}
                        </Box>
                        {editor ? (
                          <Stack direction="row" spacing={0.25}>
                            <Tooltip title="Edit">
                              <IconButton
                                component={Link}
                                href={`/garage/${vehicleId}/build/${t.id}/edit`}
                                size="small"
                                aria-label="Edit task"
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <DeleteIconButton
                              action={deleteBuildTask.bind(null, t.id, vehicleId)}
                              confirmMessage={`Delete "${t.title}"?`}
                              label="Delete task"
                            />
                          </Stack>
                        ) : null}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
