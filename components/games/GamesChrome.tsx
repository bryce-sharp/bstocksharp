"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { usePathname } from "next/navigation";
import { gameAtPath } from "@/lib/games";

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
  const chrome = gameAtPath(usePathname())?.chrome;
  // A game's own colors, laid over the shared header without changing its layout.
  const skin = chrome
    ? {
        "& .MuiAppBar-root": {
          bgcolor: chrome.background,
          color: chrome.text,
          borderBottom: `2px ${chrome.dividerStyle ?? "solid"} ${chrome.divider}`,
        },
      }
    : {};
  const tabSkin = chrome
    ? { bgcolor: chrome.background, color: chrome.text, borderColor: chrome.divider, "&:hover": { bgcolor: chrome.background } }
    : {};

  const barRef = React.useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = React.useState(64);
  React.useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Only a tap animates, so a page that loads with the bar tucked away does not slide on arrival.
  const [animate, setAnimate] = React.useState(false);
  const toggle = () => {
    setAnimate(true);
    write(!hidden);
  };

  return (
    // flow-root keeps the bar's negative margin inside, so the page gets shorter and games notice the resize.
    <Box sx={{ display: "flow-root" }}>
      {/* Hidden, the bar sits just above the screen with only its tab showing, and the page moves up into its place. */}
      <Box
        sx={{
          position: "sticky",
          top: hidden ? -barHeight : 0,
          mt: hidden ? `${-barHeight}px` : 0,
          zIndex: 1100,
          transition: animate ? "top 280ms ease, margin-top 280ms ease" : "none",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          ...skin,
        }}
      >
        <div ref={barRef} inert={hidden}>
          {header}
        </div>
        <IconButton aria-label={hidden ? "Show the menu" : "Hide the menu"} onClick={toggle} sx={{ ...tabSx, ...tabSkin, top: "100%" }}>
          {hidden ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </IconButton>
      </Box>
      {children}
    </Box>
  );
}
