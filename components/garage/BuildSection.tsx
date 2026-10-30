import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import AddIcon from "@mui/icons-material/Add";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { listBuildTasks } from "@/lib/queries/build";
import BuildPlan from "@/components/garage/BuildPlan";

export default async function BuildSection({
  vehicleId,
  editor,
}: {
  vehicleId: number;
  editor: boolean;
}) {
  const tasks = await listBuildTasks(vehicleId);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">Build plan</Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/garage/${vehicleId}/build/new`}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            Add task
          </Button>
        ) : null}
      </Stack>

      {tasks.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <TuneOutlinedIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {editor
              ? "No build tasks yet — plan the build phase by phase (reliability first, power last)."
              : "No build tasks yet."}
          </Typography>
        </Paper>
      ) : (
        <BuildPlan tasks={tasks} vehicleId={vehicleId} editor={editor} />
      )}
    </Box>
  );
}
