import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import { GAMES } from "@/lib/games";

export const metadata = { title: "Games" };

export default function GamesPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 6 } }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1">
          Games
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" fontWeight={400}>
          Little games I have made
        </Typography>
      </Stack>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        {GAMES.map((g) => (
          <Card key={g.slug} variant="outlined">
            <CardActionArea component={Link} href={g.href} sx={{ height: "100%" }}>
              <CardMedia component="img" image={g.image} alt="" sx={{ aspectRatio: "1200 / 630" }} />
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="h5" component="h2">
                    {g.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {g.tagline}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
        <Card variant="outlined" sx={{ borderStyle: "dashed" }}>
          <Box
            sx={{ aspectRatio: "1200 / 630", display: "grid", placeItems: "center", bgcolor: "action.hover" }}
          >
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.2em" }}>
              Coming soon
            </Typography>
          </Box>
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="h5" component="h2">
                A new game
              </Typography>
              <Typography variant="body2" color="text.secondary">
                A new daily puzzle is in the works. Check back soon.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
