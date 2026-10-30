import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import MuiLink from "@mui/material/Link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export const metadata = { title: "Buying guide — The Miata Bible" };

const INSPECTION: { category: string; items: string[]; note?: string }[] = [
  {
    category: "Underneath — front & rear (get on your back)",
    items: [
      "Bent metal or missing pieces behind both bumpers",
      "Paint overspray in the wheel wells / on the coil springs",
      "Front tie-downs painted body-color (should be black — cheap-respray tell)",
      "Shock absorber leaks",
      "CV / axle boot tears",
      "Differential & transmission leaks",
      "Exhaust system condition",
      "Driveshaft damage, bent suspension pieces",
    ],
    note: "Bent metal + overspray = a past accident. Ask directly whether it's been wrecked — many won't volunteer it until you point at the evidence.",
  },
  {
    category: "Rust — the #1 killer",
    items: [
      "Rocker panels & fender arches",
      "Front & rear frame rails (especially NB front rails)",
      "Floor pans & trunk floor",
      "Under the battery tray",
      "Bubbles in the paint = rust already started underneath",
      "Magnet test on sills/rockers (steel should grab; the hood is aluminum and won't)",
    ],
    note: "Surface rust is fine. Structural rust in the frame rails is a walk-away — by the time it shows outside, the structure underneath is usually worse.",
  },
  {
    category: "Tires / Wheels / Brakes",
    items: [
      "Brake pad thickness (peer through the spokes; roll the car to see past them)",
      "Rotor scoring or cracks",
      'Tread depth ¼" or more, and wear even across the tire',
      "Sidewall cracks / cuts; matching brand-model-size all around",
      "Wheels undamaged / not curbed",
      "Spare tire actually present",
    ],
    note: "Price out pads + rotors for the specific car — it's good bargaining leverage if they're due soon.",
  },
  {
    category: "Suspension",
    items: [
      "Collapsed shock mounts / “top hats” (a spine-jarring ride is the tell — check under the hood)",
      "Worn or missing bump stops (look behind the wheel at the top of the shock body)",
      "Shock leaks",
    ],
    note: "NA rubber bump stops have all aged out — many have disintegrated entirely. Shocks + mounts are best replaced as a set of four.",
  },
  {
    category: "Soft top",
    items: [
      "Tears, wear spots (check the underside too), stains",
      "Rear window clarity — brown spots mean it'll soon go opaque",
      "Unlatch from the windshield header BEFORE working the zipper (removes tension)",
      "Raises / lowers smoothly and latches down easily",
      "Leaks or water stains inside",
    ],
    note: "Replacement top runs ~$200–600, install ~$300–500. Factor a bad top into your offer.",
  },
  {
    category: "Trunk & battery",
    items: [
      "Open the vertical fabric panel at the front of the trunk — check for bodywork behind it",
      "Jack well for standing water / rust",
      "Sealed / AGM battery only — NOT a lead-acid swap",
      "Two rubber battery drain tubes present; no acid corrosion",
    ],
    note: "A wrong (lead-acid) battery can leak acid into the trunk — budget to put the correct sealed battery back in.",
  },
  {
    category: "Body & paint",
    items: [
      "Sight down both sides in bright light for ripples / repairs",
      "Even panel gaps and seams",
      "Overspray on door sills or black rubber trim (= repaint, likely an accident)",
      "One panel fresher than the rest (it'll fade to two shades later)",
      "Clear-coat failure (cloudy / flaking) on metallic cars = needs paint",
      "Clogged drain holes: rockers + behind the seat-belt towers",
    ],
    note: "Black-painted rockers are stock on most NAs — body-color rockers usually mean a respray (except certain '96–97 special editions).",
  },
  {
    category: "Interior & electrics",
    items: [
      "Cracked dash; seat-bolster wear on the driver's getting-in side",
      "Pedal-pad wear consistent with the odometer",
      "Replaced-speedo notification sticker by the door cert label",
      "OEM radio slow to power on = needs a repair",
      "All controls, gauges, lights, and the power antenna work",
      "Both pop-up headlights, all windows, A/C blows cold",
    ],
    note: "Ask about any modifications and get the details — you're inheriting someone else's project.",
  },
  {
    category: "Under hood (engine off)",
    items: [
      "General cleanliness — does it look neglected?",
      "Oil & coolant leaks; accident damage around the radiator / headlights",
      "Dipstick: oil level & color — metallic sparkle = walk away",
      "Drive belts for cracks; rock the water-pump pulley for play",
      "Brake & clutch reservoirs: level + fluid color (dark = change soon)",
      "Power-steering reservoir level / leaks; A/C compressor oil leaks",
      "Coolant hoses supple, not crunchy-hard with age",
      "Radiator top black (brown = near end of life, olive = in between)",
    ],
    note: "NA: an oil leak below the crank angle sensor (CAS) means the heater-hose (1.8) or water-plug (1.6) O-ring is failing — a cheap part, but may also need a valve-cover gasket.",
  },
  {
    category: "Timing belt",
    items: [
      "Ask when it was last done (due ~60k, safe to ~90k)",
      "Ask about spark plugs & plug wires — wires often go bad ~30k",
      "If the history is unknown, budget to replace it",
    ],
    note: "The NA/NB is a non-interference engine — if the belt snaps, the engine usually survives. Still, don't drive on an unknown-age belt.",
  },
  {
    category: "Engine — cold start & running",
    items: [
      "Exhaust smoke: blue = oil, white = coolant / head gasket, black = rich",
      "Rod knock = bad; a light 'lifter tick' (HLA) that tracks RPM and isn't constant = usually just annoying",
      "Rev slowly up — a knock that appears then fades = early rod / main bearing wear",
      "Steady idle, no side-to-side shake",
      "Crank pulley wobble while running (especially 1990 / early-'91)",
      "A/C on: both radiator fans spin, cold at the vents within 30s",
      "A/C noise: knock = bad compressor, squeal = loose belt, faint whistle = usually OK",
    ],
    note: "Bubbles in the A/C sight glass = low charge / possible leak.",
  },
  {
    category: "Glass",
    items: [
      "Side windows operate smoothly",
      "Cracks, checking, or discoloration",
      "Windshield sand-pitting / stone chips",
      "Wiper-blade scuffing",
    ],
  },
  {
    category: "Misc & VIN check",
    items: [
      "VIN matches the title (all sticker locations listed at the bottom)",
      "All exterior lights work; locks operate",
      "Boot cover present (desirable — UV-protects the folded top)",
    ],
  },
];

const TEST_DRIVE = {
  intro:
    "Top up, windows closed, radio off — the Miata is noisy with the top up, and you want to hear the mechanicals, not the wind.",
  items: [
    "Rear whirring is usually tire noise; a grind that changes with road speed but NOT engine RPM = wheel bearings or diff",
    "Gear whine in one or more gears (try reverse too) = worn transmission bearings",
    'Handbrake feels solid, rises ~3", and actually holds the car',
    "Clutch engages smoothly — no slip or chatter; run up & down the gears feeling for bad synchros (2nd is usually the first to go)",
    "Brakes: solid pedal, stops straight, no pulsation (warped rotors)",
    "Quick left / right turns feel planted, not wallowy; little play in the wheel",
    "15 mph in 1st, on/off the gas — feel for slack in the driveline",
    "Clutch-slip test: 45 mph in 5th, rev ~2k over, pop the clutch — RPM should snap back (be gentle, not your car yet)",
    "60–70 mph: check the infamous 65 mph shimmy (balance / tires), wandering on road grooves, and wallow over bumps (tired shocks)",
    "Stop-and-go: no stutter, misfire, or bog after a shift (plug wires… or worse)",
    "Pulls smoothly & strongly in every gear",
    "Lifter tapping should quit 15–30s after a cold start — if it doesn't, suspect infrequent oil changes or the wrong oil",
  ],
};

const GOTCHAS: { title: string; body: string }[] = [
  {
    title: "Short Nose Crank (SNC) — 1990–91 NA",
    body: "If the VIN ends 209446 or lower, research the SNC issue before buying. It's a known weak point on the earliest cars.",
  },
  {
    title: "Salvage / branded title",
    body: "Hard to insure & finance, and worth roughly half a clean-title car. Not automatically a no — but get a PPI and price it accordingly.",
  },
  {
    title: "NB clutch shudder — 2001–02",
    body: "Shudder on cold take-off is a known issue with a Mazda service bulletin — not necessarily a worn clutch.",
  },
  {
    title: "NB2 immobilizer — 2001–05",
    body: "Immobilizer / ECU failures are increasingly common and replacement parts are scarce. Confirm it starts reliably every time.",
  },
  {
    title: "Get a PPI if you have any doubt",
    body: "A pre-purchase inspection is about an hour of shop time and checks every major system. If the seller balks at one, that's a red flag.",
  },
];

const VIN_LOCATIONS = [
  "Driver's-side dash, under the windshield (plate)",
  "Door jamb next to the strike plate — both sides (sticker)",
  "Door next to the latch — both sides (sticker)",
  'Firewall — ¼" stamped letters on a welded plate',
  "Hood (sticker)",
  "Front fender — NA: in the water run-off gully, both sides; NB: rear edge where fender meets door, seen with the door open",
  "Inside front bumper, passenger side, just under the turn signal (sticker)",
  "Trunk (sticker)",
  "Inside rear driver's-side fender, just ahead of the bumper under the gas-fill hose (sticker)",
  "Passenger side of the aluminum oil pan (riveted metal plate)",
  "PPF (power plant frame), top side, roughly center — stamped letters",
];

const SELLER_QUESTIONS = [
  "Do you have maintenance records?",
  "When were the timing belt & water pump done?",
  "Has the radiator been replaced?",
  "Has the clutch been replaced?",
  "Any accidents?",
  "Salvage or branded title — ever?",
  "Any paint or body work?",
  "Any rust repair?",
  "Has the speedometer ever been replaced?",
  "Was it garage kept?",
  "Ever driven in winter / salt?",
  "Clean title in hand?",
  "Do the original parts come with it?",
];

export default function BuyingGuidePage() {
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
        Buying guide
      </Typography>
      <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400 }}>
        Your goal isn&apos;t to find a perfect Miata — it&apos;s to find one
        someone else didn&apos;t ruin. A clean, stock, maintained 170k-mile car
        beats a 90k-mile eBay-turbo with cut springs every time.
      </Typography>

      <Alert severity="info" sx={{ mt: 3 }}>
        <strong>Bring:</strong> a flashlight, a JIS (or Phillips) screwdriver, a
        ground cloth to lie on, a magnet for rust checks, hand wipes — and a
        car-savvy friend if you have one.
      </Alert>

      <Alert severity="warning" sx={{ my: 2 }}>
        The single biggest deal-breaker is <strong>structural rust</strong>. Check
        the frame rails and floor pans first — everything else is negotiable.
      </Alert>

      <Stack spacing={2}>
        {INSPECTION.map((group) => (
          <Paper key={group.category} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
              {group.category}
            </Typography>
            <List dense disablePadding>
              {group.items.map((item) => (
                <ListItem key={item} disableGutters sx={{ py: 0.25, alignItems: "flex-start" }}>
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    <CheckBoxOutlineBlankIcon fontSize="small" color="disabled" />
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
            {group.note ? (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 1, fontStyle: "italic" }}
              >
                {group.note}
              </Typography>
            ) : null}
          </Paper>
        ))}
      </Stack>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h4" component="h2" gutterBottom>
        Test drive
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        {TEST_DRIVE.intro}
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <List dense disablePadding>
          {TEST_DRIVE.items.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.25, alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                <CheckBoxOutlineBlankIcon fontSize="small" color="disabled" />
              </ListItemIcon>
              <ListItemText primary={item} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h4" component="h2" gutterBottom>
        Model-specific gotchas
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <List dense disablePadding>
          {GOTCHAS.map((g) => (
            <ListItem key={g.title} disableGutters sx={{ py: 0.5, alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                <ReportProblemOutlinedIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText
                primary={g.title}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                secondary={g.body}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h4" component="h2" gutterBottom>
        Questions to ask the seller
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
        <List dense disablePadding>
          {SELLER_QUESTIONS.map((q) => (
            <ListItem key={q} disableGutters sx={{ py: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <HelpOutlineIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText primary={q} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Accordion variant="outlined" disableGutters sx={{ mt: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            VIN sticker locations (for matching numbers)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List dense disablePadding>
            {VIN_LOCATIONS.map((loc, i) => (
              <ListItem key={loc} disableGutters sx={{ py: 0.25, alignItems: "flex-start" }}>
                <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {i + 1}.
                  </Typography>
                </ListItemIcon>
                <ListItemText primary={loc} />
              </ListItem>
            ))}
          </List>
        </AccordionDetails>
      </Accordion>

      <Typography variant="body2" sx={{ color: "text.secondary", mt: 3 }}>
        Condensed from{" "}
        <MuiLink
          href="https://www.miata.net/garage/Checking%20Out%20a%20Used%20Miata%20-%20Update%202018.pdf"
          target="_blank"
          rel="noopener noreferrer"
        >
          Checking Out a Used NA or NB Miata
        </MuiLink>{" "}
        and its companion inspection list (Miata.net community, Aug 2018).
      </Typography>
    </Container>
  );
}
