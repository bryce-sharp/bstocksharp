"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AppsIcon from "@mui/icons-material/Apps";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import Typography from "@mui/material/Typography";
import CheckIcon from "@mui/icons-material/Check";
import { useRouter } from "next/navigation";
import { getApp, visibleApps } from "@/lib/apps";
import { DEV_PAGES, isDevSite } from "@/lib/dev";
import { switchBookAction } from "@/app/actions/books";

/** The viewer's money books, listed under Finance; `activeId` is the one this device works in. */
export type SwitcherBooks = { books: { id: number; name: string }[]; activeId: number | null };

// The subtle app switcher: the current app's name is a button that opens a menu.
// On mobile the menu also holds this app's nav (Today/Catalog) — those show
// inline in the header on desktop, so they're hidden (sm+) here to avoid dupes.
// `hiddenApps` are the active profile's hidden slugs, so the switcher matches
// the hub (an app hidden there doesn't reappear here). The viewer's money books
// sit indented under Finance, so any app can jump straight into one.
export default function AppSwitcher({
  current,
  nav = [],
  hiddenApps = [],
  hubApps,
  books,
}: {
  current: string;
  nav?: { label: string; href: string }[];
  hiddenApps?: string[];
  hubApps?: string[];
  books?: SwitcherBooks | null;
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
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const activeBook =
    current === "finance" ? books?.books.find((b) => b.id === books.activeId)?.name : undefined;

  function openBook(id: number) {
    close();
    startTransition(async () => {
      if (id !== books?.activeId) await switchBookAction(id);
      if (current !== "finance") router.push("/finance");
    });
  }

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
        {activeBook ? (
          <Box
            component="span"
            sx={{ fontWeight: 600, color: "text.secondary", ml: 0.75, maxWidth: { xs: 110, sm: 200 }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            · {activeBook}
          </Box>
        ) : null}
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
        {apps.flatMap((a) => [
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
          </MenuItem>,
          ...(a.slug === "finance" && books?.books.length
            ? [
                ...books.books.map((b) => (
                  <MenuItem key={`book-${b.id}`} dense onClick={() => openBook(b.id)}>
                    <ListItemText inset secondary={b.name} />
                    {current === "finance" && b.id === books.activeId ? (
                      <CheckIcon fontSize="small" color="primary" sx={{ ml: 2 }} />
                    ) : null}
                  </MenuItem>
                )),
                <MenuItem key="manage-books" dense component={Link} href="/finance/books" onClick={close}>
                  <ListItemText inset secondary="Manage books…" />
                </MenuItem>,
              ]
            : []),
        ])}
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
        {/* Dev pages (lib/dev) exist only on your own machine, so only there are they listed. */}
        {isDevSite
          ? [
              <Divider key="dev-divider" />,
              <Typography key="dev-title" variant="overline" sx={{ color: "text.secondary", px: 2, display: "block" }}>
                Dev pages · localhost
              </Typography>,
              ...DEV_PAGES.map((d) => (
                <MenuItem key={d.href} component={Link} href={d.href} onClick={close} dense>
                  <ListItemIcon>
                    <BuildOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText secondary={d.about}>{d.name}</ListItemText>
                </MenuItem>
              )),
            ]
          : null}
      </Menu>
    </>
  );
}
