import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import LoopIcon from "@mui/icons-material/Loop";
import AddIcon from "@mui/icons-material/Add";
import { isEditor } from "@/lib/auth";
import { getAssignments, listWorkoutsWithCreator } from "@/lib/queries/workout";
import { getActiveProfile } from "@/lib/profile";
import PrivateNotice from "@/components/shared/PrivateNotice";
import { canView } from "@/lib/sharing";
import WeekSchedule from "@/components/workout/WeekSchedule";
import Chip from "@mui/material/Chip";

export const metadata = { title: "Workout" };

export default async function WorkoutDashboard({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile } = await searchParams;
  const activeProfile = await getActiveProfile(profile);
  if (activeProfile && !(await canView(activeProfile, "workout"))) {
    return <PrivateNotice title={`${activeProfile.name} keeps their workouts private`} />;
  }

  const [assignments, library, editor] = await Promise.all([
    activeProfile ? getAssignments(activeProfile.id) : Promise.resolve([]),
    listWorkoutsWithCreator(),
    isEditor(),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={1} sx={{ mb: 3 }}>
        <Typography variant="h3" component="h1">
          Workout
        </Typography>
        <Typography
          variant="h6"
          component="p"
          sx={{ color: "text.secondary", fontWeight: 400 }}
        >
          Tonight&apos;s exercises — pick a day and press start.
        </Typography>
      </Stack>

      {/* Today + this profile's week (switch people via the header) */}
      {activeProfile ? (
        <Box sx={{ mb: 5 }}>
          <WeekSchedule
            assignments={assignments}
            profileName={activeProfile.name}
            profileId={activeProfile.id}
            editor={editor}
          />
        </Box>
      ) : null}

      {/* Shared workout library */}
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
      >
        <Typography variant="h5" component="h2">
          Workout library
        </Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/workout/new${activeProfile ? `?profile=${activeProfile.id}` : ""}`}
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ flexShrink: 0 }}
          >
            New
          </Button>
        ) : null}
      </Stack>
      {library.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>No workouts saved yet.</Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          {library.map((w) => (
            <Card key={w.id} variant="outlined">
              <CardActionArea
                component={Link}
                href={`/workout/${w.id}`}
                sx={{ height: "100%" }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" component="h3">
                      {w.name}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      {w.rounds > 1 ? (
                        <Chip
                          icon={<LoopIcon />}
                          label={`${w.rounds} rounds`}
                        />
                      ) : null}
                      {w.createdByName ? (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          saved by {w.createdByName}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
}
