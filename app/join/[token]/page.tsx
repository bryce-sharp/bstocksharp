import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "@/components/shared/AppLink";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { getSession } from "@/lib/session";
import { getJoinableInvite } from "@/lib/queries/invites";
import JoinForm from "./JoinForm";

export const metadata = { title: "You're invited — Hub" };

// The invite landing page — the hub's one PUBLIC page besides /login (the
// proxy allowlists /join/*; the unguessable token is the credential). Dead
// links (unknown, revoked, expired, used up) all get the same generic message.
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite, session] = await Promise.all([
    getJoinableInvite(token),
    getSession(),
  ]);

  if (!invite) {
    return (
      <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2} alignItems="flex-start">
            <LinkOffIcon color="disabled" fontSize="large" />
            <Typography variant="h5" component="h1">
              This invite isn&apos;t valid
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The link may have expired, been used already, or been revoked.
              Ask whoever invited you for a fresh one.
            </Typography>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Already signed in? Accepting would need a second login on this device —
  // keep it simple: point them at their hub, or tell them to sign out first.
  if (session) {
    return (
      <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="h5" component="h1">
              You&apos;re already signed in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This invite creates a <strong>new</strong> login. To use it, sign
              out first (profile menu → Sign out), then open the link again.
            </Typography>
            <Button component={Link} href="/" variant="outlined">
              Back to your hub
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs" sx={{ py: { xs: 6, md: 10 } }}>
      <JoinForm token={token} groupName={invite.groupName} personName={invite.personName} />
    </Container>
  );
}
