"use client";

import * as React from "react";
import Script from "next/script";
import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import MuiLink from "@mui/material/Link";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import SubmitButton from "@/components/shared/SubmitButton";
import { signUpAction } from "@/app/actions/signup";

type Turnstile = { render: (el: HTMLElement, opts: { sitekey: string }) => string; remove: (id: string) => void };

// Self sign-up for games (mirrors JoinForm). Turnstile renders into its box and
// adds its token to the form as cf-turnstile-response.
export default function SignUpForm({ from, siteKey }: { from: string; siteKey: string | null }) {
  const [state, formAction] = React.useActionState(signUpAction, null);
  const box = React.useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = React.useState(false);

  React.useEffect(() => {
    const turnstile = (window as { turnstile?: Turnstile }).turnstile;
    if (!siteKey || !box.current || !turnstile) return;
    const id = turnstile.render(box.current, { sitekey: siteKey });
    return () => turnstile.remove(id);
  }, [siteKey, scriptReady, state]);

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setScriptReady(true)}
      />
      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
        <form action={formAction}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SportsEsportsIcon color="primary" />
              <Typography variant="h5" component="h1">
                Create an account
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Save your games so they follow you to every device.
            </Typography>

            {!siteKey ? <Alert severity="info">New accounts are closed for now.</Alert> : null}
            {state ? <Alert severity="error">{state.error}</Alert> : null}
            <input type="hidden" name="from" value={from} />
            {/* Hidden from people; bots that fill every field give themselves away. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              style={{ position: "absolute", left: -10000, width: 1, height: 1, opacity: 0 }}
            />
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
              helperText="At least 8 characters. There is no email reset, so keep it somewhere safe."
            />
            <TextField
              name="confirm"
              type="password"
              label="Confirm password"
              autoComplete="new-password"
              required
              fullWidth
            />
            <div ref={box} style={{ minHeight: 65 }} />
            <SubmitButton variant="contained" size="large" pendingLabel="Creating…" disabled={!siteKey}>
              Create my account
            </SubmitButton>
            <Typography variant="body2" color="text.secondary">
              Already have one?{" "}
              <MuiLink component={Link} href={from ? `/login?from=${encodeURIComponent(from)}` : "/login"}>
                Sign in
              </MuiLink>
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
