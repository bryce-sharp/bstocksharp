import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import { formatMiles, formatMoney, formatDate } from "@/lib/format";
import { vehicleSpend, listVehicleDueRecords } from "@/lib/queries/summaries";
import { recordDueStatus } from "@/lib/reminders";
import type { Vehicle } from "@/lib/db/schema";

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

const rank = (s: string) => (s === "overdue" ? 0 : 1);

export default async function VehicleOverview({ vehicle }: { vehicle: Vehicle }) {
  const [spend, dueRecords] = await Promise.all([
    vehicleSpend(vehicle.id),
    listVehicleDueRecords(vehicle.id),
  ]);

  const now = new Date();
  const reminders = dueRecords
    .map((r) => ({ ...r, status: recordDueStatus(r, vehicle.currentMileage, now) }))
    .filter((r) => r.status !== "ok")
    .sort((a, b) => rank(a.status) - rank(b.status));

  const facts: [string, string][] = [
    ["Status", vehicle.status],
    ["Current mileage", formatMiles(vehicle.currentMileage)],
    ["Transmission", vehicle.transmission ?? "—"],
    ["Exterior", vehicle.color ?? "—"],
    ["Interior", vehicle.interiorColor ?? "—"],
    ["VIN", vehicle.vin ?? "—"],
    ["Plate", vehicle.licensePlate ?? "—"],
    ["Purchased", formatDate(vehicle.purchaseDate)],
    ["Purchase price", formatMoney(vehicle.purchasePrice)],
    ["Purchase mileage", formatMiles(vehicle.purchaseMileage)],
  ];

  return (
    <Stack spacing={3}>
      {reminders.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="subtitle2">Reminders</Typography>
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {reminders.map((r) => (
              <Stack
                key={r.id}
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
                spacing={1}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.serviceType}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {[
                      r.nextDueDate ? `by ${formatDate(r.nextDueDate)}` : null,
                      r.nextDueMileage != null
                        ? `at ${formatMiles(r.nextDueMileage)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={r.status === "overdue" ? "error" : "warning"}
                  label={r.status === "overdue" ? "Overdue" : "Due soon"}
                  sx={{ flexShrink: 0 }}
                />
              </Stack>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: "repeat(3, 1fr)",
        }}
      >
        <Stat label="Total spent" value={formatMoney(spend.total)} />
        <Stat label="Maintenance" value={formatMoney(spend.maintenance)} />
        <Stat label="Fuel" value={formatMoney(spend.fuel)} />
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 } }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" },
          }}
        >
          {facts.map(([label, value]) => (
            <Box key={label}>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                {label}
              </Typography>
              <Typography
                variant="body1"
                sx={{ textTransform: label === "Status" ? "capitalize" : "none" }}
              >
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
        {vehicle.notes ? (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}
            >
              {vehicle.notes}
            </Typography>
          </>
        ) : null}
      </Paper>
    </Stack>
  );
}
