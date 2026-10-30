"use client";

import * as React from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import CelebrationOutlinedIcon from "@mui/icons-material/CelebrationOutlined";
import SubmitButton from "@/components/shared/SubmitButton";
import { redeemInviteAction } from "@/app/actions/join";

// The signup form behind an invite link (mirrors LoginForm's useActionState
// pattern). groupName null = an "own hub" invite — they get a fresh hub.
export default function JoinForm({
  token,
  groupName,
  personName,
}: {
  token: string;
  groupName: string | null;
  /** The person this login will be, for a sign-in link sent from their card. */
  personName: string | null;
}) {
  const [state, formAction] = React.useActionState(redeemInviteAction, null);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
      <form action={formAction}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <CelebrationOutlinedIcon color="primary" />
            <Typography variant="h5" component="h1">
              You&apos;re invited
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {groupName && personName ? (
              <>
                Make a login to join <strong>{groupName}</strong> as{" "}
                <strong>{personName}</strong>. Your stuff there will be yours alone.
              </>
            ) : groupName ? (
              <>
                Create a login to join <strong>{groupName}</strong> — you&apos;ll
                see everything this household shares.
              </>
            ) : (
              <>
                Create a login and you&apos;ll get your <strong>own hub</strong> —
                a fresh space that&apos;s all yours.
              </>
            )}
          </Typography>

          {state ? <Alert severity="error">{state.error}</Alert> : null}
          <input type="hidden" name="token" value={token} />
          <TextField
            name="username"
            label="Pick a username"
            autoComplete="username"
            autoCapitalize="none"
            required
            fullWidth
            helperText="Lowercase letters, numbers, dots and dashes."
          />
          <TextField
            name="password"
            type="password"
            label="Password"
            autoComplete="new-password"
            required
            fullWidth
            helperText="At least 8 characters."
          />
          <TextField
            name="confirm"
            type="password"
            label="Confirm password"
            autoComplete="new-password"
            required
            fullWidth
          />
          <SubmitButton variant="contained" size="large" pendingLabel="Creating…">
            Create my login
          </SubmitButton>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Tip: after signing in you can add a passkey (Face ID) from the
            profile menu, so you never type this password again.
          </Typography>
        </Stack>
      </form>
    </Paper>
  );
}
