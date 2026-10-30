import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import MuiLink from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";

export const metadata = { title: "Resources — The Miata Bible" };

const GUIDES: { name: string; href: string; meta?: string }[] = [
  {
    name: "Checking Out a Used NA or NB Miata",
    href: "https://www.miata.net/garage/Checking%20Out%20a%20Used%20Miata%20-%20Update%202018.pdf",
    meta: "Miata.net community · Aug 2018 — the full-length article our buying guide is condensed from.",
  },
];

const CHANNELS: { name: string; href?: string }[] = [
  { name: "Flyin' Miata", href: "https://www.flyinmiata.com" },
  { name: "The Car Passion Channel" },
  { name: "Donut (older Miata series)" },
  { name: "SavageGeese" },
];

const FORUMS: { name: string; href: string }[] = [
  { name: "Miata.net", href: "https://www.miata.net" },
  { name: "r/Miata", href: "https://www.reddit.com/r/Miata" },
];

const SPECS_TO_KEEP = [
  "Torque specs (lug nuts, drain plugs, common fasteners)",
  "Fluid capacities (engine, transmission, differential, coolant)",
  "Paint code",
  "Wheel specs (offset, bolt pattern)",
  "Alignment specs",
];

export default function ResourcesPage() {
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
        Resources
      </Typography>

      <Stack spacing={2} sx={{ mt: 2 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            Guides
          </Typography>
          <List dense disablePadding>
            {GUIDES.map((g) => (
              <ListItem
                key={g.name}
                disableGutters
                sx={{ py: 0.25, alignItems: "flex-start" }}
              >
                <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                  <ArticleOutlinedIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <MuiLink href={g.href} target="_blank" rel="noopener noreferrer">
                      {g.name}
                    </MuiLink>
                  }
                  secondary={g.meta}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            YouTube
          </Typography>
          <List dense disablePadding>
            {CHANNELS.map((c) => (
              <ListItem key={c.name} disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <PlayCircleOutlineIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    c.href ? (
                      <MuiLink href={c.href} target="_blank" rel="noopener noreferrer">
                        {c.name}
                      </MuiLink>
                    ) : (
                      c.name
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            Forums
          </Typography>
          <List dense disablePadding>
            {FORUMS.map((f) => (
              <ListItem key={f.name} disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ForumOutlinedIcon fontSize="small" color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <MuiLink href={f.href} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </MuiLink>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            Specs to keep handy
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
            Fill these in once you have the car — they save time on every job.
          </Typography>
          <List dense disablePadding>
            {SPECS_TO_KEEP.map((s) => (
              <ListItem key={s} disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <BuildOutlinedIcon fontSize="small" color="disabled" />
                </ListItemIcon>
                <ListItemText primary={s} />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Stack>
    </Container>
  );
}
