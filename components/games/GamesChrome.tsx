"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const KEY = "games.headerHidden";
const listeners = new Set<() => void>();
// Kept in memory too, so the toggle still works where storage is blocked.
let memory = false;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return memory;
  }
}

function write(hidden: boolean) {
  memory = hidden;
  try {
    if (hidden) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

const tabSx = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  width: 44,
  height: 22,
  borderRadius: "0 0 10px 10px",
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
  borderTop: "none",
  "&:hover": { bgcolor: "background.paper" },
} as const;

/** The site header above the games, which players can tuck away to see just the game. */
export default function GamesChrome({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const hidden = React.useSyncExternalStore(subscribe, read, () => false);

  return (
    <>
      {hidden ? (
        <IconButton aria-label="Show the menu" onClick={() => write(false)} sx={{ ...tabSx, position: "fixed", top: 0, zIndex: 1100 }}>
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      ) : (
        <Box sx={{ position: "sticky", top: 0, zIndex: 1100 }}>
          {header}
          <IconButton aria-label="Hide the menu" onClick={() => write(true)} sx={{ ...tabSx, top: "100%" }}>
            <ExpandLessIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
      {children}
    </>
  );
}
