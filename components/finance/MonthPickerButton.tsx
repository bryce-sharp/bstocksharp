"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { formatMonth } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The month label doubles as a jump-to picker: a year stepper over a 3×4 month
// grid, bounded by the earliest data and the current month, so going back to
// January is one tap instead of a render per month.
export default function MonthPickerButton({
  month,
  earliestMonth,
  currentMonth,
  basePath,
}: {
  month: string; // YYYY-MM-01 being viewed
  earliestMonth: string; // YYYY-MM-01
  currentMonth: string; // YYYY-MM-01
  basePath: string;
}) {
  const router = useRouter();
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [year, setYear] = React.useState(Number(month.slice(0, 4)));
  const minYear = Number(earliestMonth.slice(0, 4));
  const maxYear = Number(currentMonth.slice(0, 4));

  function open(e: React.MouseEvent<HTMLElement>) {
    setYear(Number(month.slice(0, 4)));
    setAnchor(e.currentTarget);
  }

  function pick(key: string) {
    setAnchor(null);
    router.push(key === currentMonth ? basePath : `${basePath}?month=${key.slice(0, 7)}`);
  }

  return (
    <>
      <Button
        size="small"
        color="inherit"
        onClick={open}
        aria-haspopup="dialog"
        sx={{ minWidth: 76, px: 1, fontWeight: 600 }}
      >
        {formatMonth(month)}
      </Button>
      <Popover
        open={anchor != null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Box sx={{ p: 1.5, width: 244 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <IconButton
              size="small"
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= minYear}
              aria-label="Previous year"
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontWeight: 600 }}>{year}</Typography>
            <IconButton
              size="small"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= maxYear}
              aria-label="Next year"
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.5 }}>
            {MONTHS.map((label, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}-01`;
              const isViewed = key === month;
              return (
                <Button
                  key={key}
                  size="small"
                  variant={isViewed ? "contained" : "text"}
                  color={isViewed ? "primary" : "inherit"}
                  disabled={key < earliestMonth || key > currentMonth}
                  onClick={() => pick(key)}
                  sx={{ minWidth: 0, px: 0, py: 0.75 }}
                >
                  {label}
                </Button>
              );
            })}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
