"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import { useColorScheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TabletMacIcon from "@mui/icons-material/TabletMac";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccountsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonAvatar from "@/components/shared/PersonAvatar";
import { logoutAction } from "@/app/actions/session";

const noop = () => () => {};

// The top-right menu is always you: the person your login is (or the hub's shared login), plus
// the app-wide bits. Whose stuff you are looking at is picked inside each app
// that has per-person data (ViewingMenu), never here.
export default function AccountMenu({
  me,
  hubLogin,
  hubName,
  username,
  hubSettings,
  accountSettings,
}: {
  /** The person this login is; null for the shared login and for a login tied to no one. */
  me: { name: string; color: string | null } | null;
  hubLogin: boolean;
  /** The hub's name (Home): the shared login goes by it. */
  hubName: string;
  username: string | null;
  /** False for a games-only hub with one login, which has nothing to manage there. */
  hubSettings: boolean;
  /** False for the shared login, which the owner manages from Hub settings. */
  accountSettings: boolean;
}) {
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const [, startTransition] = React.useTransition();

  // Color mode. useColorScheme() is undefined until mounted, so guard the toggle.
  const { mode, systemMode, setMode } = useColorScheme();
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);
  const isDark = (mode === "system" ? systemMode : mode) === "dark";

  const closeMenu = () => setAnchor(null);
  const label = me?.name ?? (hubLogin ? hubName : (username ?? "Account"));

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`${label}: open account menu`}
        sx={{ textTransform: "none", minWidth: 0, gap: 0.75, px: 1 }}
      >
        {me ? (
          <PersonAvatar person={me} />
        ) : hubLogin ? (
          <TabletMacIcon fontSize="small" />
        ) : (
          <PersonOutlineIcon />
        )}
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" }, fontWeight: 600 }}>
          {label}
        </Box>
        <KeyboardArrowDownIcon fontSize="small" />
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu}>
        {username ? (
          <Typography variant="body2" sx={{ color: "text.secondary", px: 2, py: 0.75 }}>
            Signed in as <strong>{username}</strong>
            {me ? ` (${me.name})` : hubLogin ? ` (${hubName}'s shared login)` : ""}
          </Typography>
        ) : null}
        {username ? <Divider /> : null}

        <MenuItem onClick={() => setMode(isDark ? "light" : "dark")} disabled={!mounted}>
          <ListItemIcon>
            {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{isDark ? "Light mode" : "Dark mode"}</ListItemText>
        </MenuItem>

        <Divider />

        {accountSettings ? (
          <MenuItem component={Link} href="/account" onClick={closeMenu}>
            <ListItemIcon>
              <ManageAccountsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Your account…</ListItemText>
          </MenuItem>
        ) : null}
        {hubSettings ? (
          <MenuItem component={Link} href="/group" onClick={closeMenu}>
            <ListItemIcon>
              <GroupsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Hub settings…</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => {
            closeMenu();
            startTransition(() => logoutAction());
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sign out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
