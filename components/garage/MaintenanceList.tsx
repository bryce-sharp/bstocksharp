"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { deleteMaintenance } from "@/app/actions/maintenance";
import { formatDate, formatMiles, formatMoney } from "@/lib/format";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import type { MaintenanceRecord } from "@/lib/db/schema";

const CATEGORIES = ["maintenance", "repair", "upgrade", "cosmetic", "safety"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function MaintenanceList({
  records,
  vehicleId,
  editor,
}: {
  records: MaintenanceRecord[];
  vehicleId: number;
  editor: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((r) => {
      if (category && r.category !== category) return false;
      if (needle) {
        const hay = [r.serviceType, r.vendor, r.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [records, q, category]);

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <TextField
          size="small"
          placeholder="Search service, vendor, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          sx={{ minWidth: { sm: 170 } }}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {cap(c)}
            </option>
          ))}
        </TextField>
      </Stack>

      {filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No records match your filter.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((r) => {
            const nextDue = [
              r.nextDueDate ? formatDate(r.nextDueDate) : null,
              r.nextDueMileage != null ? formatMiles(r.nextDueMileage) : null,
            ].filter(Boolean);

            return (
              <Paper key={r.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ justifyContent: "space-between" }} spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {r.serviceType}
                      </Typography>
                      {r.category ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={r.category}
                          sx={{ textTransform: "capitalize" }}
                        />
                      ) : null}
                    </Stack>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {[
                        formatDate(r.serviceDate),
                        r.mileage != null ? formatMiles(r.mileage) : null,
                        r.vendor,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                  </Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, flexShrink: 0 }}
                  >
                    {formatMoney(r.cost)}
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

                {nextDue.length > 0 ? (
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    label={`Next due: ${nextDue.join(" · ")}`}
                  />
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
                        href={`/garage/${vehicleId}/maintenance/${r.id}/edit`}
                        size="small"
                        aria-label="Edit record"
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <DeleteIconButton
                      action={deleteMaintenance.bind(null, r.id, vehicleId)}
                      confirmMessage={`Delete "${r.serviceType}"?`}
                      label="Delete record"
                    />
                  </Stack>
                ) : null}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
