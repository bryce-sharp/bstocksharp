"use client";

import * as React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import LogoutIcon from "@mui/icons-material/Logout";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SubmitButton from "@/components/shared/SubmitButton";
import {
  leaveHubAction,
  transferOwnershipAction,
  deleteHubAction,
} from "@/app/actions/group";

// The hub's exit doors (Phase E close-out). Non-owners can LEAVE (their login
// dies, their person/data stay). The owner can TRANSFER the role, and — the
// only truly irreversible thing in the app — DELETE the hub, gated by typing
// the hub's exact name (re-checked server-side).

export default function DangerZone({
  isOwner,
  groupName,
  others, // members excluding the viewer (transfer targets)
}: {
  isOwner: boolean;
  groupName: string;
  others: { id: number; username: string }[];
}) {
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, borderColor: "error.main", borderStyle: "dashed" }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle2" color="error">
          Danger zone
        </Typography>

        {!isOwner ? (
          <Box>
            <Button
              color="error"
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={() => setLeaveOpen(true)}
            >
              Leave this hub
            </Button>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
              Deletes your login (and its passkeys). People and data stay.
            </Typography>
          </Box>
        ) : (
          <>
            {others.length > 0 ? (
              <form action={transferOwnershipAction}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                  <TextField
                    name="newOwnerId"
                    label="Transfer ownership to"
                    select
                    size="small"
                    defaultValue=""
                    sx={{ minWidth: 220 }}
                    slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  >
                    <option value="">Choose a member…</option>
                    {others.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.username}
                      </option>
                    ))}
                  </TextField>
                  <SubmitButton variant="outlined" startIcon={<SwapHorizIcon />} pendingLabel="Transferring…">
                    Transfer
                  </SubmitButton>
                </Stack>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                  They take over invites and member removal; your data and claims are untouched.
                  You can leave the hub afterward if you want out entirely.
                </Typography>
              </form>
            ) : null}

            <Box>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteForeverIcon />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete this hub forever
              </Button>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                Everything goes: people, cars, workouts, weigh-ins, logins, invites. No undo.
              </Typography>
            </Box>
          </>
        )}
      </Stack>

      {/* Leave confirm */}
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Leave {groupName}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Your login is deleted immediately and you&apos;ll be signed out. The
            people and data in this hub stay exactly as they are — you just
            can&apos;t get in anymore unless someone invites you again.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveOpen(false)} color="inherit">
            Stay
          </Button>
          <form action={leaveHubAction}>
            <SubmitButton color="error" variant="contained" pendingLabel="Leaving…">
              Leave hub
            </SubmitButton>
          </form>
        </DialogActions>
      </Dialog>

      {/* Delete-forever confirm (type the name) */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete {groupName} forever?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              This deletes <strong>everything</strong> — every person, car,
              workout, weigh-in, login and invite in this hub. There is no
              undo. Type <strong>{groupName}</strong> to confirm.
            </Typography>
            <TextField
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              label="Hub name"
              placeholder={groupName}
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} color="inherit">
            Keep the hub
          </Button>
          <form action={deleteHubAction}>
            <input type="hidden" name="confirm" value={typed} />
            <SubmitButton
              color="error"
              variant="contained"
              disabled={typed.trim() !== groupName}
              pendingLabel="Deleting…"
            >
              Delete forever
            </SubmitButton>
          </form>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
