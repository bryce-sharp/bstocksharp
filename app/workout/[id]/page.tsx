import Link from "@/components/shared/AppLink";
import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import LoopIcon from "@mui/icons-material/Loop";
import { canEditProfile, isEditMode } from "@/lib/auth";
import { getWorkoutWithItems } from "@/lib/queries/workout";
import { copyWorkout } from "@/app/actions/workout";
import SubmitButton from "@/components/shared/SubmitButton";
import {
  formatTarget,
  groupBySection,
  SECTIONS,
  type ResolvedItem,
} from "@/lib/workout";
import ExerciseInfoButton from "@/components/workout/ExerciseInfoButton";
import SavedToast from "@/components/shared/SavedToast";
import Chip from "@mui/material/Chip";

function ItemRow({ index, it }: { index: number; it: ResolvedItem }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, color: "text.secondary", minWidth: 22, textAlign: "center" }}
        >
          {index}
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {it.name}
        </Typography>
        <ExerciseInfoButton name={it.name} description={it.description} />
        <Chip
          icon={
            it.mode === "timed" ? <TimerOutlinedIcon /> : <RepeatOutlinedIcon />
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
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", pl: "30px", mt: 0.5 }}
        >
          {it.note}
        </Typography>
      ) : null}
    </Paper>
  );
}

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const data = await getWorkoutWithItems(Number(id));
  if (!data) notFound();

  const { workout, creatorName, items } = data;
  const bySection = groupBySection(items);

  // Workouts are edit-owned: only the creator (unlocked) may edit. Anyone in edit
  // mode can Copy it to their own side and tweak from there.
  const [canEdit, inEditMode] = await Promise.all([
    canEditProfile(workout.createdByProfileId),
    isEditMode(),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      {saved ? <SavedToast message="Workout saved" /> : null}
      {/* Back on the left, actions on the right — the title below gets the full
          width to wrap, so a long name can't force horizontal scroll on mobile. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Button component={Link} href="/workout" startIcon={<ArrowBackIcon />}>
          All workouts
        </Button>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {canEdit ? (
            <Button
              component={Link}
              href={`/workout/${workout.id}/edit`}
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
            >
              Edit
            </Button>
          ) : null}
          {inEditMode ? (
            <form action={copyWorkout.bind(null, workout.id)}>
              <SubmitButton
                variant="outlined"
                color="inherit"
                startIcon={<ContentCopyIcon />}
                pendingLabel="Copying…"
              >
                Copy
              </SubmitButton>
            </form>
          ) : null}
        </Stack>
      </Stack>

      <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
        {workout.name}
      </Typography>

      {/* Count + "saved by" on one line */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", mb: 4 }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {items.length} exercise{items.length === 1 ? "" : "s"}
        </Typography>
        {creatorName ? (
          <Chip label={`saved by ${creatorName}`} color="primary" />
        ) : null}
      </Stack>

      {items.length > 0 ? (
        <Button
          component={Link}
          href={`/workout/${workout.id}/run`}
          variant="contained"
          size="large"
          fullWidth
          startIcon={<PlayArrowIcon />}
          sx={{ py: 1.5, fontSize: "1.05rem", mb: 4 }}
        >
          Start workout
        </Button>
      ) : null}

      <Stack spacing={4}>
        {SECTIONS.map((s) => {
          const sectionItems = bySection[s.value];
          if (sectionItems.length === 0) return null;
          const isCircuit = s.value === "main" && workout.rounds > 1;

          return (
            <Box key={s.value}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", mb: isCircuit ? 0.5 : 1.5 }}
              >
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

              {isCircuit ? (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 1.5 }}
                >
                  Rotate through these {workout.rounds} times.
                </Typography>
              ) : null}

              <Stack spacing={1.5}>
                {sectionItems.map((it, i) => (
                  <ItemRow key={it.itemId} index={i + 1} it={it} />
                ))}
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Container>
  );
}
