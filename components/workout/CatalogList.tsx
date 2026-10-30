"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  CATEGORIES,
  categoryLabel,
  formatDuration,
  equipmentLabel,
  canDoWithEquipment,
} from "@/lib/workout";
import { deleteExercise } from "@/app/actions/workout";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import MyEquipmentButton from "@/components/workout/MyEquipmentButton";
import Chip from "@mui/material/Chip";
import type { Exercise } from "@/lib/db/schema";

// Reps only → "10-12". Reps + per-rep time → "10 × 5s". Time only → "45s".
function summary(e: Exercise): string {
  if (e.defaultReps) {
    return e.defaultDuration != null
      ? `${e.defaultReps} × ${formatDuration(e.defaultDuration)}`
      : e.defaultReps;
  }
  return e.defaultDuration != null ? formatDuration(e.defaultDuration) : "";
}

export default function CatalogList({
  exercises,
  editor,
  ownedEquipment,
  activeProfileId,
  activeProfileName,
}: {
  exercises: Exercise[];
  editor: boolean;
  ownedEquipment: string[];
  activeProfileId: number | null;
  activeProfileName: string | null;
}) {
  const [q, setQ] = React.useState("");
  const [hideUndoable, setHideUndoable] = React.useState(false);

  // Filtering only kicks in once you've said what you own — an empty list means
  // "not set up yet", so we show everything (see profiles.equipment default []).
  const owned = React.useMemo(() => new Set(ownedEquipment), [ownedEquipment]);
  const filterActive = ownedEquipment.length > 0;
  const canDo = React.useCallback(
    (e: Exercise) => !filterActive || canDoWithEquipment(e.equipment, [...owned]),
    [filterActive, owned],
  );

  const query = q.trim().toLowerCase();
  const searched = query
    ? exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          categoryLabel(e.category).toLowerCase().includes(query) ||
          (e.description ?? "").toLowerCase().includes(query),
      )
    : exercises;
  // Non-destructive: dim what you can't do; only actually remove it when asked.
  const filtered =
    filterActive && hideUndoable ? searched.filter(canDo) : searched;

  // Group by category in canonical order (unknowns last).
  const order = new Map<string, number>(CATEGORIES.map((c, i) => [c.value, i]));
  const groups = filtered.reduce<Record<string, Exercise[]>>((acc, e) => {
    (acc[e.category ?? "other"] ??= []).push(e);
    return acc;
  }, {});
  const keys = Object.keys(groups).sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99),
  );

  return (
    <>
      <TextField
        placeholder="Search exercises…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 1.5 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", mb: 3, minHeight: 40 }}
      >
        {filterActive ? (
          <FormControlLabel
            control={
              <Switch
                checked={hideUndoable}
                onChange={(e) => setHideUndoable(e.target.checked)}
                size="small"
              />
            }
            label="Hide what I can't do"
          />
        ) : editor ? (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Set your equipment to filter the catalog to what you can do.
          </Typography>
        ) : (
          <span />
        )}
        {editor && activeProfileId != null ? (
          <MyEquipmentButton
            profileId={activeProfileId}
            profileName={activeProfileName ?? "This person"}
            owned={ownedEquipment}
            size="small"
          />
        ) : null}
      </Stack>

      {filtered.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>
          No exercises match “{q}”.
        </Typography>
      ) : (
        <Stack spacing={4}>
          {keys.map((k) => (
            <Box key={k}>
              <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
                {categoryLabel(k)}
              </Typography>
              <Stack spacing={1.5}>
                {groups[k].map((e) => {
                  const doable = canDo(e);
                  const missing = filterActive
                    ? (e.equipment ?? []).filter((s) => !owned.has(s))
                    : [];
                  return (
                  <Paper
                    key={e.id}
                    variant="outlined"
                    sx={{ p: 2, opacity: doable ? 1 : 0.6 }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          sx={{ alignItems: "center", flexWrap: "wrap", mb: e.description ? 1 : 0 }}
                        >
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {e.name}
                          </Typography>
                          <Chip
                            icon={
                              e.defaultReps ? (
                                <RepeatOutlinedIcon />
                              ) : (
                                <TimerOutlinedIcon />
                              )
                            }
                            label={summary(e)}
                          />
                          {e.defaultWeight ? (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              {e.defaultWeight}
                            </Typography>
                          ) : null}
                          {e.equipment?.map((slug) => (
                            <Chip
                              key={slug}
                              size="small"
                              variant="outlined"
                              color={missing.includes(slug) ? "warning" : "default"}
                              icon={<FitnessCenterOutlinedIcon />}
                              label={equipmentLabel(slug)}
                            />
                          ))}
                          {missing.length ? (
                            <Chip
                              size="small"
                              color="warning"
                              icon={<WarningAmberOutlinedIcon />}
                              label={`You don't have: ${missing
                                .map(equipmentLabel)
                                .join(", ")}`}
                            />
                          ) : null}
                        </Stack>
                        {e.description ? (
                          <Typography variant="body2">
                            {e.description}
                          </Typography>
                        ) : null}
                      </Box>

                      {editor ? (
                        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                          <Tooltip title="Edit">
                            <IconButton
                              component={Link}
                              href={`/workout/catalog/${e.id}/edit`}
                              size="small"
                              aria-label={`Edit ${e.name}`}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <DeleteIconButton
                            action={deleteExercise.bind(null, e.id)}
                            confirmMessage={`Delete "${e.name}" from the catalog?`}
                            label={`Delete ${e.name}`}
                          />
                        </Stack>
                      ) : null}
                    </Stack>
                  </Paper>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </>
  );
}
