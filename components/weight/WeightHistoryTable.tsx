"use client";

import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { formatDate } from "@/lib/format";
import { updateWeighIn, deleteWeighIn } from "@/app/actions/weight";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import LogWeightDialog from "./LogWeightDialog";

type Row = {
  id: number;
  measuredOn: string;
  weight: number;
  note: string | null;
  delta: number | null;
};

export default function WeightHistoryTable({
  profileId,
  rows,
  editor,
}: {
  profileId: number;
  rows: Row[];
  editor: boolean;
}) {
  const [editing, setEditing] = React.useState<Row | null>(null);

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Weight</TableCell>
              <TableCell align="right">Δ</TableCell>
              <TableCell>Note</TableCell>
              {editor ? <TableCell align="right">Edit</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {formatDate(r.measuredOn)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {r.weight}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color:
                      r.delta == null || r.delta === 0
                        ? "text.disabled"
                        : r.delta < 0
                          ? "success.main"
                          : "warning.main",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta}`}
                </TableCell>
                <TableCell
                  sx={{
                    color: "text.secondary",
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.note ?? ""}
                </TableCell>
                {editor ? (
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          aria-label="Edit weigh-in"
                          onClick={() => setEditing(r)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <DeleteIconButton
                        action={deleteWeighIn.bind(null, r.id, profileId)}
                        confirmMessage={`Delete the ${formatDate(r.measuredOn)} weigh-in?`}
                        label="Delete weigh-in"
                      />
                    </Stack>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {rows.length === 0 ? (
        <Typography sx={{ color: "text.secondary", mt: 2 }}>
          No weigh-ins yet.
        </Typography>
      ) : null}

      {editing ? (
        <LogWeightDialog
          open
          onClose={() => setEditing(null)}
          action={updateWeighIn.bind(null, editing.id, profileId)}
          title="Edit weigh-in"
          submitLabel="Save changes"
          defaultDate={editing.measuredOn}
          initialWeight={editing.weight}
          initialNote={editing.note}
        />
      ) : null}
    </>
  );
}
