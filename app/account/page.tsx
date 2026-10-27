import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Link from "@/components/shared/AppLink";
import EditProfileButton from "@/components/shared/EditProfileButton";
import SharingButton from "@/components/shared/SharingButton";
import SignInSection from "./SignInSection";
import DeleteAccount from "./DeleteAccount";
import { getSession } from "@/lib/session";
import { isOwner } from "@/lib/auth";
import { getMyGroup, listGroupMembers } from "@/lib/queries/groups";
import { listAllProfiles } from "@/lib/queries/profiles";
import { currentLogin, hubApps } from "@/lib/hub-apps";

export const metadata = { title: "Your account" };

// The signed-in login's own settings: the person it is, and its password and
// passkeys. The household's settings live on /group.
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ nudge?: string; next?: string }>;
}) {
  const { nudge, next } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login?from=/account");
  // The hub login is set up by the owner in Hub settings; it has no account page of its own.
  if ((await currentLogin())?.isHubLogin) redirect("/");

  const [members, profiles, owner, offeredApps, group] = await Promise.all([
    listGroupMembers(),
    listAllProfiles(),
    isOwner(),
    hubApps(),
    getMyGroup(),
  ]);
  const me = members.find((m) => m.id === session.accountId);
  const mine = profiles.find((p) => p.id === me?.profileId && !p.archivedAt);
  const others = profiles.filter((p) => !p.archivedAt && p.id !== mine?.id);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={2.5}>
        <Typography variant="h5" component="h1" fontWeight={800}>
          Your account
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Signed in as <strong>{me?.username}</strong>.
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          {mine ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  fontWeight: 700,
                  bgcolor: mine.color ?? "primary.main",
                  color: "#fff",
                }}
              >
                {mine.name.trim().charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography fontWeight={600}>{mine.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Your name, color, and the apps you see
                </Typography>
              </Box>
              <EditProfileButton
                profileId={mine.id}
                profileName={mine.name}
                profileColor={mine.color}
                profileHiddenApps={mine.hiddenApps}
                archived={false}
                canDeactivate={others.length > 0}
                heirs={others.map((p) => ({ id: p.id, name: p.name }))}
                offeredApps={offeredApps}
              />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
              <Typography variant="body2">
                This login is not tied to a person yet. Claim yourself on the
                hub&apos;s People list.
              </Typography>
              <Button component={Link} href="/group" size="small">
                Go to People
              </Button>
            </Stack>
          )}
        </Paper>

        {mine ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography fontWeight={600}>Who can see your stuff</Typography>
                <Typography variant="caption" color="text.secondary">
                  Your weight and workouts, app by app
                </Typography>
              </Box>
              <SharingButton
                profileId={mine.id}
                name={mine.name}
                self
                sharing={mine.sharing}
                people={others.map((p) => ({ id: p.id, name: p.name }))}
                hubApps={offeredApps}
                hubName={members.some((m) => m.isHubLogin) ? (group?.name ?? "Hub") : null}
              />
            </Box>
          </Paper>
        ) : null}

        <SignInSection
          accountId={session.accountId}
          iat={session.iat}
          isOwner={owner}
          nudge={nudge === "1"}
          next={next ?? "/"}
        />

        {me && !group?.isDemo ? (
          <DeleteAccount username={me.username} alone={owner && members.length === 1} />
        ) : null}
      </Stack>
    </Container>
  );
}
