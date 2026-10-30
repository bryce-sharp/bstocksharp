import Link from "@/components/shared/AppLink";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { formatMiles } from "@/lib/format";
import VehicleCardMenu from "@/components/garage/VehicleCardMenu";
import type { Vehicle } from "@/lib/db/schema";
import Chip from "@mui/material/Chip";

const STATUS_COLOR: Record<string, "primary" | "default" | "warning"> = {
  owned: "primary",
  dream: "primary",
  prospect: "warning",
  sold: "default",
};

export default function VehicleCard({
  vehicle,
  editor,
  reminder,
}: {
  vehicle: Vehicle;
  editor: boolean;
  reminder?: "overdue" | "soon";
}) {
  const subtitle = [vehicle.year, vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return (
    <Card variant="outlined" sx={{ position: "relative", height: "100%" }}>
      {editor ? <VehicleCardMenu vehicleId={vehicle.id} /> : null}
      <CardActionArea
        component={Link}
        href={`/garage/${vehicle.id}`}
        sx={{ height: "100%" }}
      >
        <CardContent>
          {/* Reserve room for the top-right ⋮ menu on the header text only, so
              the pill row below stays flush-right in both edit + read modes. */}
          <Box sx={{ pr: editor ? 3 : 0 }}>
            <Typography variant="h6" component="h2" noWrap>
              {vehicle.name}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center", mt: 1.5 }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {formatMiles(vehicle.currentMileage)}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              {vehicle.visibility === "private" ? (
                <Chip
                  size="small"
                  variant="outlined"
                  icon={<LockOutlinedIcon />}
                  label="Private"
                />
              ) : null}
              {reminder ? (
                <Chip
                  size="small"
                  variant="outlined"
                  color={reminder === "overdue" ? "error" : "warning"}
                  label={reminder === "overdue" ? "Overdue" : "Service soon"}
                />
              ) : null}
              <Chip
                label={vehicle.status}
                size="small"
                color={STATUS_COLOR[vehicle.status] ?? "default"}
                variant="outlined"
                sx={{ textTransform: "capitalize" }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
