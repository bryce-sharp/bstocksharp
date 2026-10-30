"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SubmitButton from "@/components/shared/SubmitButton";
import { deleteMyAccountAction } from "@/app/actions/group";

// The account's own exit. Alone in their hub (a games sign-up), people delete
// the account and its hub here; anyone sharing a hub leaves or hands it over
// from Hub settings, which this points to.
export default function DeleteAccount({ username, alone }: { username: string; alone: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");

  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: "error.main", borderStyle: "dashed" }}>
      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Typography variant="subtitle2" color="error">
          Delete your account
        </Typography>
        {alone ? (
          <>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Deletes your login and everything saved to it, games included. There is no undo.
            </Typography>
            <Button color="error" variant="outlined" startIcon={<DeleteForeverIcon />} onClick={() => setOpen(true)}>
              Delete my account
            </Button>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Your login shares a hub with other people. Leave the hub, or hand it over if you own it, from{" "}
            <MuiLink component={Link} href="/group?tab=settings">
              Hub settings
            </MuiLink>
            .
          </Typography>
        )}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Your login, your person and everything saved to them are deleted, and you are signed out. Type{" "}
              <strong>{username}</strong> to confirm.
            </Typography>
            <TextField
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              label="Username"
              autoCapitalize="none"
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="inherit">
            Keep it
          </Button>
          <form action={deleteMyAccountAction}>
            <input type="hidden" name="confirm" value={typed} />
            <SubmitButton
              color="error"
              variant="contained"
              disabled={typed.trim().toLowerCase() !== username}
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
