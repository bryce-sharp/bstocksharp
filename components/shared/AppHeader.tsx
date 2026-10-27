"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import AppSwitcher, { type SwitcherBooks } from "@/components/shared/AppSwitcher";

// Shared header used by each sub-app. The app-switcher gives it identity + a way
// to hop between apps; `nav` holds app-specific links. Appearance + the editing
// lock now live inside the profile/account menu (`profileControl`).
export default function AppHeader({
  current,
  nav = [],
  hiddenApps = [],
  hubApps,
  books,
  appControl,
  profileControl,
}: {
  current: string;
  nav?: { label: string; href: string }[];
  hiddenApps?: string[];
  /** The apps this hub has; omitted means every app. */
  hubApps?: string[];
  /** The viewer's money books, listed under Finance in the app menu. */
  books?: SwitcherBooks | null;
  /** Whose stuff this app shows (the Viewing picker), beside the account menu. */
  appControl?: React.ReactNode;
  profileControl?: React.ReactNode;
}) {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        color: "text.primary",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ gap: 0.5 }}>
        <AppSwitcher current={current} nav={nav} hiddenApps={hiddenApps} hubApps={hubApps} books={books} />
        {/* Inline nav on desktop; on mobile it lives in the switcher menu. */}
        <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 0.5 }}>
          {nav.map((n) => (
            <Button
              key={n.href}
              component={Link}
              href={n.href}
              color="inherit"
              size="small"
            >
              {n.label}
            </Button>
          ))}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        {appControl}
        {profileControl}
      </Toolbar>
    </AppBar>
  );
}
