import Link from "@/components/shared/AppLink";
import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoopIcon from "@mui/icons-material/Loop";
import DoneIcon from "@mui/icons-material/Done";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { canEditProfile } from "@/lib/auth";
import {
  getWorkout,
  getWorkoutItemsWithExercises,
  listExercises,
} from "@/lib/queries/workout";
import { listProfiles } from "@/lib/queries/profiles";
import { getActiveProfile } from "@/lib/profile";
import {
  updateWorkout,
  deleteWorkout,
  addWorkoutItem,
} from "@/app/actions/workout";
import { resolveItem, SECTIONS, equipmentLabel, type Section } from "@/lib/workout";
import WorkoutMetaAutoSave from "@/components/workout/WorkoutMetaAutoSave";
import AddExerciseControl from "@/components/workout/AddExerciseControl";
import BuilderItemRow from "@/components/workout/BuilderItemRow";
import MyEquipmentButton from "@/components/workout/MyEquipmentButton";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import Chip from "@mui/material/Chip";

export const metadata = { title: "Edit workout — Workout" };

export default async function WorkoutBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workoutId = Number(id);
  if (!Number.isInteger(workoutId)) notFound();

  const [workout, rows, profiles, catalog, active] = await Promise.all([
    getWorkout(workoutId),
    getWorkoutItemsWithExercises(workoutId),
    listProfiles(),
    listExercises(),
    getActiveProfile(),
  ]);
  if (!workout) notFound();

  // Workouts are edit-owned: only the creator (unlocked) can open the builder.
  // Everyone else gets sent to the view, where they can Copy it to their side.
  if (!(await canEditProfile(workout.createdByProfileId))) {
    redirect(`/workout/${workoutId}`);
  }

  // Group each row (raw item + exercise + resolved display) by section.
  const bySection: Record<Section, (typeof rows)[number][]> = {
    warmup: [],
    main: [],
    cooldown: [],
  };
  for (const row of rows) {
    const section = resolveItem(row.item, row.exercise).section;
    bySection[section].push(row);
  }

  // Gear this workout uses (union across its items) vs. what the active person
  // owns. Filtering is off until they set their equipment (empty owned = show all).
  const owned = new Set(active?.equipment ?? []);
  const usedEquipment = [
    ...new Set(rows.flatMap((r) => r.exercise.equipment ?? [])),
  ];
  const missingEquipment = owned.size
    ? usedEquipment.filter((s) => !owned.has(s))
    : [];

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href={`/workout/${workoutId}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        View workout
      </Button>

      <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
        Edit workout
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
        Everything here saves automatically.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 4 }}>
        <WorkoutMetaAutoSave
          action={updateWorkout.bind(null, workoutId)}
          workout={workout}
          profiles={profiles}
        />
      </Paper>

      {usedEquipment.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 4 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
            useFlexGap
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Equipment this workout uses
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
                {usedEquipment.map((slug) => (
                  <Chip
                    key={slug}
                    size="small"
                    variant="outlined"
                    color={missingEquipment.includes(slug) ? "warning" : "default"}
                    icon={<FitnessCenterOutlinedIcon />}
                    label={equipmentLabel(slug)}
                  />
                ))}
              </Stack>
            </Box>
            {active ? (
              <MyEquipmentButton
                profileId={active.id}
                profileName={active.name}
                owned={active.equipment ?? []}
                size="small"
              />
            ) : null}
          </Stack>
          {missingEquipment.length > 0 ? (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mt: 1.5, color: "warning.main" }}
            >
              <WarningAmberOutlinedIcon fontSize="small" />
              <Typography variant="body2">
                Heads up — {active?.name ?? "you"} hasn&apos;t marked{" "}
                {missingEquipment.map(equipmentLabel).join(", ")} as owned. You can
                still build and run it.
              </Typography>
            </Stack>
          ) : null}
        </Paper>
      ) : null}

      <Stack spacing={4}>
        {SECTIONS.map((s) => {
          const sectionRows = bySection[s.value];
          const isCircuit = s.value === "main" && workout.rounds > 1;
          return (
            <Box key={s.value}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
                <Typography variant="h5" component="h2">
                  {s.label}
                </Typography>
                {isCircuit ? (
                  <Chip
                    color="primary"
                    variant="filled"
                    icon={<LoopIcon />}
                    label={`${workout.rounds} rounds`}
                  />
                ) : null}
              </Stack>

              <Stack spacing={1} sx={{ mb: 1.5 }}>
                {sectionRows.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Nothing here yet.
                  </Typography>
                ) : (
                  sectionRows.map((row, i) => (
                    <BuilderItemRow
                      key={row.item.id}
                      resolved={resolveItem(row.item, row.exercise)}
                      item={row.item}
                      exercise={row.exercise}
                      workoutId={workoutId}
                      itemId={row.item.id}
                      isFirst={i === 0}
                      isLast={i === sectionRows.length - 1}
                    />
                  ))
                )}
              </Stack>

              <AddExerciseControl
                action={addWorkoutItem.bind(null, workoutId)}
                section={s.value}
                exercises={catalog}
                ownedEquipment={active?.equipment ?? []}
              />
            </Box>
          );
        })}
      </Stack>

      <Button
        component={Link}
        href={`/workout/${workoutId}`}
        variant="contained"
        size="large"
        startIcon={<DoneIcon />}
        sx={{ mt: 4 }}
      >
        Done
      </Button>

      <Divider sx={{ my: 4 }} />

      <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
        <DeleteIconButton
          action={deleteWorkout.bind(null, workoutId)}
          confirmMessage={`Delete the workout "${workout.name}"? This can't be undone.`}
          label="Delete workout"
        />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Delete this workout (also removes it from any day it&apos;s assigned to).
        </Typography>
      </Stack>
    </Container>
  );
}
