import Link from "@/components/shared/AppLink";
import { notFound, redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import LoopIcon from "@mui/icons-material/Loop";
import { isEditor } from "@/lib/auth";
import { getAssignments, listWorkoutsWithCreator } from "@/lib/queries/workout";
import { getActiveProfile } from "@/lib/profile";
import PrivateNotice from "@/components/shared/PrivateNotice";
import { canView } from "@/lib/sharing";
import { WEEKDAYS } from "@/lib/workout";
import Chip from "@mui/material/Chip";
import QuickStartList from "@/components/workout/QuickStartList";

export const metadata = { title: "Day — Workout" };

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekday: string }>;
  searchParams: Promise<{ profile?: string }>;
}) {
  const { weekday } = await params;
  const wd = Number(weekday);
  if (!Number.isInteger(wd) || wd < 0 || wd > 6) notFound();

  const { profile } = await searchParams;
  const [activeProfile, editor] = await Promise.all([
    getActiveProfile(profile),
    isEditor(),
  ]);
  if (!activeProfile) redirect("/workout");
  if (!(await canView(activeProfile, "workout"))) {
    return <PrivateNotice title={`${activeProfile.name} keeps their workouts private`} />;
  }

  const assignments = await getAssignments(activeProfile.id);
  const a = assignments.find((x) => x.weekday === wd) ?? null;

  // On a rest day we offer an ad-hoc option: start any saved workout now,
  // without touching the schedule. Only needed when nothing's assigned.
  const library = a ? [] : await listWorkoutsWithCreator();

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href={`/workout?profile=${activeProfile.id}`}
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back to week
      </Button>

      <Box sx={{ mb: 1 }}>
        <Chip label={activeProfile.name} color="primary" />
      </Box>
      <Typography variant="h3" component="h1" sx={{ mb: 3 }}>
        {WEEKDAYS[wd].label}
      </Typography>

      {a ? (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h5" component="h2">
              {a.workoutName}
            </Typography>
            {a.rounds > 1 ? (
              <Chip
                color="primary"
                variant="filled"
                icon={<LoopIcon />}
                label={`${a.rounds} rounds`}
              />
            ) : null}
          </Stack>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              component={Link}
              href={`/workout/${a.workoutId}/run`}
              variant="contained"
              startIcon={<PlayArrowIcon />}
            >
              Start
            </Button>
            <Button
              component={Link}
              href={`/workout/${a.workoutId}`}
              variant="outlined"
            >
              View
            </Button>
            {editor ? (
              <Button
                component={Link}
                href={`/workout/${a.workoutId}/edit`}
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
              >
                Edit workout
              </Button>
            ) : null}
            {editor ? (
              <Button
                component={Link}
                href={`/workout/schedule?profile=${activeProfile.id}`}
                color="inherit"
                startIcon={<EditCalendarIcon />}
              >
                Change this day
              </Button>
            ) : null}
          </Stack>
        </Paper>
      ) : (
        <>
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Rest day
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: editor ? 2 : 0 }}
            >
              Nothing scheduled for this day yet.
            </Typography>
            {editor ? (
              <Stack spacing={1.5}>
                <Button
                  component={Link}
                  href={`/workout/new?profile=${activeProfile.id}&weekday=${wd}`}
                  variant="contained"
                  startIcon={<AddIcon />}
                >
                  Build a workout for this day
                </Button>
                <Button
                  component={Link}
                  href={`/workout/schedule?profile=${activeProfile.id}`}
                  variant="outlined"
                  startIcon={<EditCalendarIcon />}
                >
                  Assign an existing workout
                </Button>
              </Stack>
            ) : null}
          </Paper>

          {/* Ad-hoc: start any saved workout now, no scheduling involved. */}
          {library.length > 0 ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                Just do one now
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Start any saved workout — this won&apos;t change your schedule.
              </Typography>
              <QuickStartList workouts={library} />
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Enjoy the rest day. 💤
            </Typography>
          )}
        </>
      )}
    </Container>
  );
}
