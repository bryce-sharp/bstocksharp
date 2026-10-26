"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AppsIcon from "@mui/icons-material/Apps";
import { getApp, visibleApps } from "@/lib/apps";

// The subtle app switcher: the current app's name is a button that opens a menu.
// On mobile the menu also holds this app's nav (Today/Catalog) — those show
// inline in the header on desktop, so they're hidden (sm+) here to avoid dupes.
// `hiddenApps` are the active profile's hidden slugs, so the switcher matches
// the hub (an app hidden there doesn't reappear here).
export default function AppSwitcher({
  current,
  nav = [],
  hiddenApps = [],
  hubApps,
}: {
  current: string;
  nav?: { label: string; href: string }[];
  hiddenApps?: string[];
  hubApps?: string[];
}) {
  const app = getApp(current);
  // Always include the app you're currently in, even if it's "hidden" (you got
  // here somehow) — but otherwise respect the hidden set.
  const shown = visibleApps(hiddenApps, hubApps);
  const apps = shown.some((a) => a.slug === current)
    ? shown
    : [...shown, getApp(current)].filter(
        (a): a is NonNullable<typeof a> => Boolean(a),
      );
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const close = () => setAnchor(null);
  const CurrentIcon = app?.Icon ?? AppsIcon;

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        startIcon={<CurrentIcon sx={{ color: "primary.main" }} />}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{
          textTransform: "none",
          fontWeight: 800,
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.01em",
          fontSize: "1.05rem",
        }}
      >
        {app?.name ?? "Apps"}
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        {/* This app's pages — mobile only (inline on desktop) */}
        {nav.map((n) => (
          <MenuItem
            key={n.href}
            component={Link}
            href={n.href}
            onClick={close}
            sx={{ display: { sm: "none" } }}
          >
            <ListItemText inset>{n.label}</ListItemText>
          </MenuItem>
        ))}
        {nav.length ? <Divider sx={{ display: { sm: "none" } }} /> : null}
        {apps.map((a) => (
          <MenuItem
            key={a.slug}
            component={Link}
            href={a.href}
            onClick={close}
            selected={a.slug === current}
          >
            <ListItemIcon>
              <a.Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{a.name}</ListItemText>
          </MenuItem>
        ))}
        {/* "All apps" only makes sense when there's a hub to go back to. An
            array (not a Fragment) so MUI's Menu can manage item focus. */}
        {apps.length > 1
          ? [
              <Divider key="all-apps-divider" />,
              <MenuItem key="all-apps" component={Link} href="/" onClick={close}>
                <ListItemIcon>
                  <AppsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>All apps</ListItemText>
              </MenuItem>,
            ]
          : null}
      </Menu>
    </>
  );
}
