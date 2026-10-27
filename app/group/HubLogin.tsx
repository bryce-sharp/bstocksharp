"use client";

import * as React from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TabletMacIcon from "@mui/icons-material/TabletMac";
import SubmitButton from "@/components/shared/SubmitButton";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import LoginApps, { AppChecks } from "./LoginApps";
import {
  createHubLoginAction,
  removeMemberAction,
  setHubLoginPasswordAction,
  type LoginFormState,
} from "@/app/actions/group";

// The shared login (owner only): one login that is no particular person,
// for a kitchen screen or family tablet. The owner picks its username,
// password and apps; on it, people with their own login are view-only.
export default function HubLogin({
  login,
  hubApps,
  hubName,
}: {
  login: { id: number; username: string; apps: string[] | null } | null;
  hubApps: string[];
  /** The hub's name (Home); the shared login goes by it. */
  hubName: string;
}) {
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Runs a login form's action, closing its dialog on success and showing the error otherwise.
  const submit = (action: (prev: LoginFormState, fd: FormData) => Promise<LoginFormState>, close: () => void) =>
    async (fd: FormData) => {
      const result = await action(null, fd);
      if (result && "error" in result) setError(result.error);
      else close();
    };
  const openDialog = (show: (open: boolean) => void) => {
    setError(null);
    show(true);
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
          <TabletMacIcon fontSize="small" color="primary" />
          <Typography fontWeight={600} noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
            {hubName} (shared login){login ? `: ${login.username}` : ""}
          </Typography>
          {login ? (
            <>
              <LoginApps accountId={login.id} username={login.username} hubApps={hubApps} apps={login.apps} />
              <Button size="small" onClick={() => openDialog(setPasswordOpen)} sx={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                New password
              </Button>
              <DeleteIconButton
                action={removeMemberAction.bind(null, login.id)}
                confirmMessage={`Remove the shared login "${login.username}"? Any screen signed in with it is signed out. People and data stay.`}
                label={`Remove shared login ${login.username}`}
              />
            </>
          ) : (
            <Button size="small" variant="outlined" onClick={() => openDialog(setSetupOpen)}>
              Set up
            </Button>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          One shared login for a kitchen screen or family tablet. It is no particular person: anyone using it can view
          everyone, but can only change people without their own login (like the kids), and only in the apps you pick.
        </Typography>
      </Stack>

      <Dialog open={setupOpen} onClose={() => setSetupOpen(false)} maxWidth="xs" fullWidth>
        <form action={submit(createHubLoginAction, () => setSetupOpen(false))}>
          <DialogTitle>Set up the shared login</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField name="username" label="Username" placeholder="e.g. kitchen" autoCapitalize="none" required fullWidth />
              <TextField name="password" type="password" label="Password" autoComplete="new-password" required fullWidth helperText="At least 8 characters. You can set a new one any time." />
              <TextField name="confirm" type="password" label="Confirm password" autoComplete="new-password" required fullWidth />
              <Box>
                <Typography variant="subtitle2">Apps it can open</Typography>
                <AppChecks hubApps={hubApps} checked={hubApps.filter((slug) => slug !== "finance")} />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSetupOpen(false)} color="inherit">
              Cancel
            </Button>
            <SubmitButton variant="contained" pendingLabel="Creating…">
              Create shared login
            </SubmitButton>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth>
        <form action={submit(setHubLoginPasswordAction, () => setPasswordOpen(false))}>
          <DialogTitle>New password for {login?.username}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <TextField name="password" type="password" label="New password" autoComplete="new-password" required fullWidth helperText="Screens signed in with the old one are signed out." />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordOpen(false)} color="inherit">
              Cancel
            </Button>
            <SubmitButton variant="contained" pendingLabel="Saving…">
              Save password
            </SubmitButton>
          </DialogActions>
        </form>
      </Dialog>
    </Paper>
  );
}
