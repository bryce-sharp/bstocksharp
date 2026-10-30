import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import { isEditor } from "@/lib/auth";
import { listExercises } from "@/lib/queries/workout";
import { getActiveProfile } from "@/lib/profile";
import CatalogList from "@/components/workout/CatalogList";

export const metadata = { title: "Catalog — Workout" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; uses?: string }>;
}) {
  const [exercises, editor, active, sp] = await Promise.all([
    listExercises(),
    isEditor(),
    getActiveProfile(),
    searchParams,
  ]);

  const blocked = sp.blocked
    ? exercises.find((e) => String(e.id) === sp.blocked)
    : null;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href="/workout"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}
      >
        <Stack spacing={1}>
          <Typography variant="h3" component="h1">
            Exercise catalog
          </Typography>
          <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400 }}>
            The building blocks for your workouts — {exercises.length} exercises.
          </Typography>
        </Stack>
        {editor ? (
          <Button
            component={Link}
            href="/workout/catalog/new"
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ flexShrink: 0 }}
          >
            Add
          </Button>
        ) : null}
      </Stack>

      {blocked ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Couldn&apos;t delete <strong>{blocked.name}</strong> — it&apos;s used in{" "}
          {sp.uses} workout{sp.uses === "1" ? "" : "s"}. Remove it from those
          first.
        </Alert>
      ) : null}

      <CatalogList
        exercises={exercises}
        editor={editor}
        ownedEquipment={active?.equipment ?? []}
        activeProfileId={active?.id ?? null}
        activeProfileName={active?.name ?? null}
      />
    </Container>
  );
}
