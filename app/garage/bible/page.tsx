import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";

export const metadata = { title: "The Miata Bible — Garage" };

const sections = [
  {
    href: "/garage/bible/buying-guide",
    title: "Buying guide",
    desc: "What to inspect and the questions to ask when you go look at an NA. Pull it up on your phone in the driveway.",
    icon: <FactCheckOutlinedIcon fontSize="large" color="primary" />,
  },
  {
    href: "/garage/bible/build-plan",
    title: "Build philosophy",
    desc: "Reliability → Safety → Handling → Power. The right order to do things, phase by phase.",
    icon: <TuneOutlinedIcon fontSize="large" color="primary" />,
  },
  {
    href: "/garage/bible/dream-spec",
    title: "Dream spec",
    desc: "The tasteful OEM+ target — BRG or white, tan interior, 15×7s, roll bar. Not slammed.",
    icon: <AutoAwesomeOutlinedIcon fontSize="large" color="primary" />,
  },
  {
    href: "/garage/bible/resources",
    title: "Resources",
    desc: "Channels, forums, and the specs worth keeping handy once you own it.",
    icon: <MenuBookOutlinedIcon fontSize="large" color="primary" />,
  },
];

export default function BiblePage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        <Box>
          <Chip
            label="NA Miata (1989–1997)"
            color="primary"
            variant="outlined"
            size="small"
          />
        </Box>
        <Typography variant="h3" component="h1">
          The Miata Bible
        </Typography>
        <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400 }}>
          Everything worth knowing before and after buying the dream NA — in one
          place, so it never gets lost in a chat log again.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        {sections.map((s) => (
          <Card key={s.href} variant="outlined">
            <CardActionArea component={Link} href={s.href} sx={{ height: "100%" }}>
              <CardContent>
                <Stack spacing={1.5}>
                  {s.icon}
                  <Typography variant="h5" component="h2">
                    {s.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {s.desc}
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Container>
  );
}
