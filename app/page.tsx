import Link from "@/components/shared/AppLink";
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import ProfileControl from "@/components/shared/ProfileControl";
import { getActiveProfile } from "@/lib/profile";
import { visibleApps } from "@/lib/apps";
import { hubApps } from "@/lib/hub-apps";

// Tab title follows whoever's active, rather than a baked-in name.
export async function generateMetadata() {
  const active = await getActiveProfile();
  return { title: active?.name ?? "Hub" };
}

// The Hub: a launcher for all the sub-apps (from the registry in lib/apps.tsx).
export default async function HubPage() {
  const [active, offered] = await Promise.all([getActiveProfile(), hubApps()]);
  const apps = visibleApps(active?.hiddenApps, offered);

  // Only one app in view → this person has no use for a launcher; take them
  // straight in. They can still reach other apps + settings from any header.
  if (active && apps.length === 1) redirect(apps[0].href);

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
        <ProfileControl />
      </Box>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 6 } }}>
        <Stack spacing={1} sx={{ mb: 4 }}>
          <Typography variant="h3" component="h1">
            {active?.name ?? "Your apps"}
          </Typography>
          {active ? (
            <Typography variant="h6" component="p" color="text.secondary" fontWeight={400}>
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
                      <Typography variant="body2" color="text.secondary">
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
