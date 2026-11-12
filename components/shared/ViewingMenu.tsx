"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckIcon from "@mui/icons-material/Check";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PersonAvatar from "@/components/shared/PersonAvatar";
import { switchProfile } from "@/app/actions/profile";

export type ViewingPick = {
  id: number;
  name: string;
  color: string | null;
  /** The other login holding this person, whose own things only they can change. */
  lockedBy: string | null;
  /** This is the person your own login is. */
  you: boolean;
  /** Their sharing keeps this app's data from you (lib/sharing). */
  private: boolean;
};

/** The list of people to view, opened from the header's Viewing chip or from the account menu. */
export function ViewingPicker({
  anchor,
  onClose,
  active,
  people,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  active: ViewingPick;
  people: ViewingPick[];
}) {
  const [, startTransition] = React.useTransition();
  return (
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onClose}>
      <Typography variant="overline" sx={{ color: "text.secondary", px: 2, display: "block" }}>
        Viewing
      </Typography>
      {people.map((p) => (
        <MenuItem
          key={p.id}
          selected={p.id === active.id}
          onClick={() => {
            onClose();
            if (p.id !== active.id) startTransition(() => switchProfile(p.id));
          }}
        >
          <ListItemIcon>
            <PersonAvatar person={p} size={24} />
          </ListItemIcon>
          <ListItemText>
            {p.name}
            {p.you || p.private ? (
              <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
                {p.you ? " (you)" : " (private here)"}
              </Typography>
            ) : null}
          </ListItemText>
          {p.lockedBy ? (
            <Tooltip
              title={`You can look, but only ${p.lockedBy} can change ${p.name}'s own things.`}
              enterTouchDelay={0}
              leaveTouchDelay={4000}
            >
              <Box component="span" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ display: "inline-flex", ml: 1 }}>
                <LockOutlinedIcon fontSize="small" titleAccess={`${p.name} has their own login`} sx={{ color: "text.disabled" }} />
              </Box>
            </Tooltip>
          ) : null}
          {p.id === active.id ? <CheckIcon fontSize="small" color="primary" sx={{ ml: 1 }} /> : null}
        </MenuItem>
      ))}
    </Menu>
  );
}

// Whose stuff this app shows, in apps with per-person data (Weight, Workout, Games, Garage, Recipes). The header
// shows this chip only while you look at someone else (or on the hub's shared login, which is no one), edged in their
// color so it is hard to miss; looking at yourself, the picker is in the account menu instead.
export default function ViewingMenu({ active, people }: { active: ViewingPick; people: ViewingPick[] }) {
  const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`Viewing ${active.name}: pick someone else`}
        sx={(theme) => {
          const edge = active.color ?? theme.palette.primary.main;
          return {
            textTransform: "none",
            minWidth: 0,
            gap: 0.75,
            px: 1.25,
            py: 0.25,
            mr: 0.5,
            borderRadius: 999,
            border: `2px solid ${edge}`,
            bgcolor: alpha(edge, 0.12),
            "&:hover": { bgcolor: alpha(edge, 0.2) },
          };
        }}
      >
        <VisibilityOutlinedIcon fontSize="small" sx={{ display: { xs: "inline-block", sm: "none" }, color: "text.secondary" }} />
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" }, color: "text.secondary", fontSize: 13 }}>
          Viewing
        </Box>
        <PersonAvatar person={active} size={22} />
        <Box component="span" sx={{ fontWeight: 600, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {active.you ? "You" : active.name}
        </Box>
        <KeyboardArrowDownIcon fontSize="small" />
      </Button>
      <ViewingPicker anchor={anchor} onClose={close} active={active} people={people} />
    </>
  );
}
