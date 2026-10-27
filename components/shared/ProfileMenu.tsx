"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import { useColorScheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import DarkModeIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeIcon from "@mui/icons-material/LightModeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import GroupsIcon from "@mui/icons-material/Groups";
import ManageAccountsIcon from "@mui/icons-material/ManageAccountsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import CheckIcon from "@mui/icons-material/Check";
import { switchProfile } from "@/app/actions/profile";
import { logoutAction } from "@/app/actions/session";

export type ProfilePick = {
  id: number;
  name: string;
  color: string | null;
  /** Username of the OTHER account claiming this profile, or null if it's
   *  unclaimed or claimed by you — i.e. whose data you can't edit. */
  lockedBy: string | null;
  /** This is the person your own login is. */
  you: boolean;
};

/** "Bryce" → "B", "Bryce Stock" → "BS". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ProfileAvatar({
  profile,
  size = 26,
}: {
  profile: ProfilePick;
  size?: number;
}) {
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        fontWeight: 700,
        bgcolor: profile.color ?? "primary.main",
        color: "#fff",
      }}
    >
      {initials(profile.name)}
    </Avatar>
  );
}

// The account menu for the whole hub: switch who you are, plus the app-wide
// bits — light/dark and the account pages (Manage group, Password & passkeys,
// Sign out). All people/login management lives on /group.
export default function ProfileMenu({
  active,
  profiles,
  hubSettings,
  accountSettings,
}: {
  active: ProfilePick | null;
  profiles: ProfilePick[];
  /** False for a games-only hub with one login, which has nothing to manage there. */
  hubSettings: boolean;
  /** False for the hub login, which the owner manages from Hub settings. */
  accountSettings: boolean;
}) {
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const [, startTransition] = React.useTransition();

  // Color mode. useColorScheme() is undefined until mounted, so guard the toggle.
  const { mode, systemMode, setMode } = useColorScheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = (mode === "system" ? systemMode : mode) === "dark";

  const closeMenu = () => setAnchor(null);

  function choose(id: number) {
    closeMenu();
    if (id !== active?.id) startTransition(() => switchProfile(id));
  }

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={active ? `${active.name} — open account menu` : "Open account menu"}
        sx={{ textTransform: "none", minWidth: 0, gap: 0.75, px: 1 }}
      >
        {active ? (
          <>
            <ProfileAvatar profile={active} />
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" }, fontWeight: 600 }}
            >
              {active.name}
            </Box>
          </>
        ) : (
          <PersonOutlineIcon />
        )}
        <KeyboardArrowDownIcon fontSize="small" />
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={closeMenu}>
        {profiles.length > 0 ? (
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ px: 2, display: "block" }}
          >
            View someone&apos;s stuff
          </Typography>
        ) : null}
        {profiles.map((p) => (
          <MenuItem
            key={p.id}
            selected={p.id === active?.id}
            onClick={() => choose(p.id)}
          >
            <ListItemIcon>
              <ProfileAvatar profile={p} size={24} />
            </ListItemIcon>
            <ListItemText>
              {p.name}
              {p.you ? (
                <Typography component="span" variant="body2" color="text.secondary">
                  {" "}
                  (you)
                </Typography>
              ) : null}
            </ListItemText>
            {/* The lock explains itself on hover, and swallows its own click so tapping it on a phone reads the note. */}
            {p.lockedBy ? (
              <Tooltip
                title={`You can look, but only ${p.lockedBy} can change ${p.name}'s own things. Shared household things stay open to everyone.`}
                enterTouchDelay={0}
                leaveTouchDelay={4000}
              >
                <Box
                  component="span"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  sx={{ display: "inline-flex", ml: 1 }}
                >
                  <LockOutlinedIcon
                    fontSize="small"
                    titleAccess={`${p.name} has their own login (${p.lockedBy})`}
                    sx={{ color: "text.disabled" }}
                  />
                </Box>
              </Tooltip>
            ) : null}
            {p.id === active?.id ? (
              <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} />
            ) : null}
          </MenuItem>
        ))}

        {profiles.length > 0 ? <Divider /> : null}

        {/* App-wide settings: appearance. */}
        <MenuItem
          onClick={() => setMode(isDark ? "light" : "dark")}
          disabled={!mounted}
        >
          <ListItemIcon>
            {isDark ? (
              <LightModeIcon fontSize="small" />
            ) : (
              <DarkModeIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>{isDark ? "Light mode" : "Dark mode"}</ListItemText>
        </MenuItem>

        <Divider />

        {/* Your own login, then the household's settings. */}
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
