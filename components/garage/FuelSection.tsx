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
import LocalGasStationOutlinedIcon from "@mui/icons-material/LocalGasStationOutlined";
import { listFuel } from "@/lib/queries/fuel";
import { deleteFuel } from "@/app/actions/fuel";
import { withMpg, fuelSummary } from "@/lib/fuel";
import { formatDate, formatMiles, formatMoney } from "@/lib/format";
import DeleteIconButton from "@/components/shared/DeleteIconButton";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
      <Typography variant="h6" component="div">
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {label}
      </Typography>
    </Paper>
  );
}

export default async function FuelSection({
  vehicleId,
  editor,
}: {
  vehicleId: number;
  editor: boolean;
}) {
  const logs = await listFuel(vehicleId);
  const rows = withMpg(logs);
  const summary = fuelSummary(logs);

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h6">Fuel &amp; MPG</Typography>
        {editor ? (
          <Button
            component={Link}
            href={`/garage/${vehicleId}/fuel/new`}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            Add fill-up
          </Button>
        ) : null}
      </Stack>

      {logs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <LocalGasStationOutlinedIcon
            sx={{ fontSize: 40, color: "text.disabled", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {editor
              ? "No fill-ups yet — log one to start tracking MPG."
              : "No fill-ups logged yet."}
          </Typography>
        </Paper>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
              mb: 2.5,
            }}
          >
            <Stat
              label="Avg MPG"
              value={summary.avgMpg != null ? summary.avgMpg.toFixed(1) : "—"}
            />
            <Stat label="Total spent" value={formatMoney(summary.totalCost)} />
            <Stat
              label="Gallons"
              value={summary.totalGallons.toFixed(1)}
            />
            <Stat label="Fill-ups" value={String(summary.count)} />
          </Box>

          <Stack spacing={1.5}>
            {rows.map((r) => (
              <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }} spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {formatDate(r.fillDate)}
                      </Typography>
                      {r.mpg != null ? (
                        <Chip
                          size="small"
                          color="primary"
                          variant="outlined"
                          label={`${r.mpg.toFixed(1)} MPG`}
                        />
                      ) : null}
                      {!r.isFullTank ? (
                        <Chip size="small" variant="outlined" label="partial" />
                      ) : null}
                    </Stack>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {[
                        r.odometer != null ? formatMiles(r.odometer) : null,
                        r.gallons != null
                          ? `${Number(r.gallons).toFixed(2)} gal`
                          : null,
                        r.pricePerGallon != null
                          ? `${formatMoney(r.pricePerGallon)}/gal`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, flexShrink: 0 }}
                  >
                    {formatMoney(r.totalCost)}
                  </Typography>
                </Stack>

                {r.notes ? (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mt: 1, whiteSpace: "pre-wrap" }}
                  >
                    {r.notes}
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
                        href={`/garage/${vehicleId}/fuel/${r.id}/edit`}
                        size="small"
                        aria-label="Edit fill-up"
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <DeleteIconButton
                      action={deleteFuel.bind(null, r.id, vehicleId)}
                      confirmMessage={`Delete the ${formatDate(r.fillDate)} fill-up?`}
                      label="Delete fill-up"
                    />
                  </Stack>
                ) : null}
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
