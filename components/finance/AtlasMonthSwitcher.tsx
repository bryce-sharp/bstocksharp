import Link from "@/components/shared/AppLink";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MonthPickerButton from "./MonthPickerButton";

/** "YYYY-MM-01" ± n months. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

// Month stepper shared by ATLAS (config time-travel) and Budget (past ledgers).
// Each ?month= is a full server render. Bounded by the earliest data and the
// current month; the label opens a jump-to-month picker, and a "back to now"
// chip appears when viewing the past.
export default function AtlasMonthSwitcher({
  month,
  earliestMonth,
  currentMonth,
  basePath = "/finance/atlas",
}: {
  month: string; // YYYY-MM-01 being viewed
  earliestMonth: string | null;
  currentMonth: string; // YYYY-MM-01
  basePath?: string;
}) {
  if (!earliestMonth || earliestMonth === currentMonth) return null;

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const isCurrent = month === currentMonth;

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <IconButton
        size="small"
        component={Link}
        href={`${basePath}?month=${prev.slice(0, 7)}`}
        disabled={prev < earliestMonth}
        aria-label="Previous month"
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <MonthPickerButton
        month={month}
        earliestMonth={earliestMonth}
        currentMonth={currentMonth}
        basePath={basePath}
      />
      <IconButton
        size="small"
        component={Link}
        href={`${basePath}?month=${next.slice(0, 7)}`}
        disabled={isCurrent}
        aria-label="Next month"
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
      {!isCurrent ? (
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          label="back to now"
          component={Link}
          href={basePath}
          clickable
        />
      ) : null}
    </Stack>
  );
}
