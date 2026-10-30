import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import InventoryOutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { listParts } from "@/lib/queries/parts";
import { deletePart } from "@/app/actions/parts";
import { formatDate, formatMoney } from "@/lib/format";
import DeleteIconButton from "@/components/shared/DeleteIconButton";

export default async function PartsSection({
  vehicleId,
  editor,
}: {
  vehicleId: number;
  editor: boolean;
}) {
  const items = await listParts(vehicleId);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">Parts inventory</Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/garage/${vehicleId}/parts/new`}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            Add part
          </Button>
        ) : null}
      </Stack>

      {items.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <InventoryOutlinedIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {editor ? "No parts logged yet — add one." : "No parts logged yet."}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {items.map((p) => (
            <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" sx={{ justifyContent: "space-between" }} spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {p.name}
                    </Typography>
                    {p.category ? (
                      <Chip size="small" variant="outlined" label={p.category} />
                    ) : null}
                  </Stack>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {[
                      p.brand,
                      p.partNumber ? `#${p.partNumber}` : null,
                      p.installedDate ? formatDate(p.installedDate) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center", flexShrink: 0 }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {formatMoney(p.cost)}
                  </Typography>
                  {p.link ? (
                    <Tooltip title="Open link">
                      <IconButton
                        component="a"
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        aria-label="Open part link"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              </Stack>

              {p.notes ? (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mt: 1, whiteSpace: "pre-wrap" }}
                >
                  {p.notes}
                </Typography>
              ) : null}

              {editor ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ justifyContent: "flex-end", mt: 1 }}
                >
                  <Tooltip title="Edit">
                    <IconButton
                      component={Link}
                      href={`/garage/${vehicleId}/parts/${p.id}/edit`}
                      size="small"
                      aria-label="Edit part"
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <DeleteIconButton
                    action={deletePart.bind(null, p.id, vehicleId)}
                    confirmMessage={`Delete "${p.name}"?`}
                    label="Delete part"
                  />
                </Stack>
              ) : null}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
