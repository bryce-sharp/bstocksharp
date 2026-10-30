import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import AddIcon from "@mui/icons-material/Add";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import { listMaintenance } from "@/lib/queries/maintenance";
import MaintenanceList from "@/components/garage/MaintenanceList";

export default async function MaintenanceSection({
  vehicleId,
  editor,
}: {
  vehicleId: number;
  editor: boolean;
}) {
  const records = await listMaintenance(vehicleId);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">Service history</Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/garage/${vehicleId}/maintenance/new`}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            Add record
          </Button>
        ) : null}
      </Stack>

      {records.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <BuildOutlinedIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {editor
              ? "No service records yet — add the first one."
              : "No service records yet."}
          </Typography>
        </Paper>
      ) : (
        <MaintenanceList
          records={records}
          vehicleId={vehicleId}
          editor={editor}
        />
      )}
    </Box>
  );
}
