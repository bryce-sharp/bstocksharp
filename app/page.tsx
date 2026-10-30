import Link from "@/components/shared/AppLink";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import AccountControl from "@/components/shared/AccountControl";
import { getMe } from "@/lib/profile";
import { getHubName } from "@/lib/queries/group";
import { visibleApps } from "@/lib/apps";
import { hubApps } from "@/lib/hub-apps";

// Tab title is you, rather than a baked-in name.
export async function generateMetadata() {
  const me = await getMe();
  return { title: me?.name ?? (await getHubName()) ?? "Hub" };
}

// The Hub: a launcher for all the sub-apps (from the registry in lib/apps.tsx).
export default async function HubPage() {
  const [me, offered, hubName] = await Promise.all([getMe(), hubApps(), getHubName()]);
  const apps = visibleApps(me?.hiddenApps, offered);

  // Only one app in view → this login has no use for a launcher; take them
  // straight in. They can still reach other apps + settings from any header.
  if (offered.length && apps.length === 1) redirect(apps[0].href);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 0.5,
          p: 2,
        }}
      >
        <AccountControl />
      </Box>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 6 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" component="h1">
            {me?.name ?? hubName ?? "Your apps"}
          </Typography>
          {me ? (
            <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400 }}>
              Your apps
            </Typography>
          ) : null}
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          {apps.map((a) => {
            const Icon = a.Icon;
            return (
              <Card key={a.slug} variant="outlined">
                <CardActionArea component={Link} href={a.href} sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Icon fontSize="large" sx={{ color: a.accent }} />
                      <Typography variant="h5" component="h2">
                        {a.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {a.tagline}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}
