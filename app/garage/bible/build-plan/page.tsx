import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CircleIcon from "@mui/icons-material/Circle";

export const metadata = { title: "Build philosophy — The Miata Bible" };

const ORDER = ["Reliability", "Safety", "Handling", "Power (last)"];

const FIRST_MONTH = [
  "Every fluid: engine oil, transmission, differential, coolant, brake, clutch",
  "Filters: air, fuel, oil — and spark plugs",
  "Accessory belts (replace if cracked)",
  "Cooling & vacuum hoses (old rubber gets brittle)",
  "Tires — check the date code; 10-year-old tires are dangerous even with tread",
  "Battery & clean up any tray rust",
  "Inspect brakes (pads, rotors, rubber lines) and suspension (bushings, shocks, ball joints, tie rods)",
];

const PHASES: { n: number; name: string; items: string[] }[] = [
  {
    n: 1,
    name: "Reliability",
    items: [
      "Fresh fluids, filters, plugs, belts, hoses (the first-month list)",
      "Aluminum radiator + silicone hoses + modern thermostat",
      "Fresh ignition wires; quality LED headlight bulbs",
    ],
  },
  {
    n: 2,
    name: "Safety",
    items: [
      "Roll bar — one of the best upgrades, protection not style",
      "Better brakes: quality pads + stainless lines + fresh fluid (no big-brake kit needed)",
      "Good tires — the single biggest performance upgrade",
    ],
  },
  {
    n: 3,
    name: "Handling",
    items: [
      "Quality adjustable coilovers or matched shocks/springs — about 1\" lower at most",
      "A proper alignment",
      "Sway bars (less body roll, no harsh ride)",
      "Poly bushings eventually — old rubber first",
    ],
  },
  {
    n: 4,
    name: "Interior / comfort",
    items: [
      "Better shift knob + a quality short shifter",
      "Nicer steering wheel (mind airbag by model year)",
      "Better speakers + hidden Bluetooth behind the dash",
    ],
  },
  {
    n: 5,
    name: "Cosmetic / fun",
    items: [
      "Slightly deeper exhaust (not obnoxious); intake for sound",
      "Lip spoiler, chassis braces, nicer seats",
      "A hardtop if you can ever find one",
    ],
  },
  {
    n: 6,
    name: "Power (last)",
    items: [
      "Cams, headers, ECU — or a turbo",
      "But drive it sorted for a season first; a stock-ish car with good suspension is more fun than a fast, neglected one",
    ],
  },
];

export default function BuildPlanPage() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href="/garage/bible"
        size="small"
        color="inherit"
        startIcon={<ArrowBackIcon />}
        sx={{ mb: 2 }}
      >
        The Bible
      </Button>

      <Typography variant="h3" component="h1" gutterBottom>
        Build philosophy
      </Typography>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        {ORDER.map((o, i) => (
          <Chip
            key={o}
            label={`${i + 1}. ${o}`}
            color={i === 0 ? "primary" : "default"}
            variant="outlined"
          />
        ))}
      </Stack>

      <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
        A Miata rewards doing things in the right order:{" "}
        <strong>reliability first, safety second, handling third, power last.</strong>{" "}
        Get the car dependable and safe before chasing speed.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Phase 0 — learn before buying.</strong> The goal isn&apos;t a
        perfect Miata, it&apos;s one that wasn&apos;t ruined. Buy the cleanest,
        most stock example you can afford (see the buying guide).
      </Alert>

      <Typography variant="h4" component="h2" gutterBottom>
        First month — assume nothing&apos;s been done
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 4 }}>
        <List dense disablePadding>
          {FIRST_MONTH.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.4, alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 26, mt: 0.9 }}>
                <CircleIcon sx={{ fontSize: 7 }} color="primary" />
              </ListItemIcon>
              <ListItemText primary={item} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Typography variant="h4" component="h2" gutterBottom>
        The phases
      </Typography>
      <Stack spacing={2}>
        {PHASES.map((p) => (
          <Paper key={p.n} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              {p.n}. {p.name}
            </Typography>
            <List dense disablePadding>
              {p.items.map((item) => (
                <ListItem
                  key={item}
                  disableGutters
                  sx={{ py: 0.3, alignItems: "flex-start" }}
                >
                  <ListItemIcon sx={{ minWidth: 26, mt: 0.9 }}>
                    <CircleIcon sx={{ fontSize: 7 }} color="disabled" />
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </Paper>
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Tip: once you own it, mirror these phases in the car&apos;s{" "}
        <strong>Build</strong> tab and check them off as you go.
      </Typography>
    </Container>
  );
}
