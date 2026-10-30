import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";

export const metadata = { title: "Dream spec — The Miata Bible" };

const SPEC = [
  "White or British Racing Green (Montego Blue if a great one turns up)",
  "Tan interior if possible",
  "Manual transmission",
  "Mostly stock appearance — nothing that screams 'project car'",
  "Factory ride height or about 1\" lower — not slammed",
  "15\" lightweight wheels (15×7 is the sweet spot)",
  "Nice summer tires",
  "Roll bar",
  "Good shocks",
  "Slightly deeper exhaust note — not obnoxious",
  "Modern Bluetooth stereo, hidden cleanly",
  "Excellent maintenance history",
];

export default function DreamSpecPage() {
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
        Dream spec — OEM+
      </Typography>
      <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400, mb: 3 }}>
        Tasteful, reliable, and unmistakably yours. Nothing flashy — just
        something that makes every drive to the grocery store feel like an event.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <List disablePadding>
          {SPEC.map((item) => (
            <ListItem key={item} disableGutters sx={{ py: 0.5, alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 34, mt: 0.5 }}>
                <CheckCircleOutlineIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText primary={item} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
}
