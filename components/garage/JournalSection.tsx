import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import { listJournal } from "@/lib/queries/journal";
import { deleteJournal } from "@/app/actions/journal";
import { formatDate, formatMiles } from "@/lib/format";
import DeleteIconButton from "@/components/shared/DeleteIconButton";

export default async function JournalSection({
  vehicleId,
  editor,
}: {
  vehicleId: number;
  editor: boolean;
}) {
  const entries = await listJournal(vehicleId);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">Build journal</Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/garage/${vehicleId}/journal/new`}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            New entry
          </Button>
        ) : null}
      </Stack>

      {entries.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <MenuBookOutlinedIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {editor
              ? "No journal entries yet — write down what you did in the garage."
              : "No journal entries yet."}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {entries.map((e) => (
            <Paper key={e.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }} spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  {e.title ? (
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {e.title}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {[
                      formatDate(e.entryDate),
                      e.mileage != null ? formatMiles(e.mileage) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                {editor ? (
                  <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                    <Tooltip title="Edit">
                      <IconButton
                        component={Link}
                        href={`/garage/${vehicleId}/journal/${e.id}/edit`}
                        size="small"
                        aria-label="Edit entry"
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <DeleteIconButton
                      action={deleteJournal.bind(null, e.id, vehicleId)}
                      confirmMessage="Delete this journal entry?"
                      label="Delete entry"
                    />
                  </Stack>
                ) : null}
              </Stack>
              <Typography
                variant="body2"
                sx={{ mt: 1, whiteSpace: "pre-wrap" }}
              >
                {e.body}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
