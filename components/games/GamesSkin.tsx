"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { HeaderSkinContext, type HeaderSkin } from "@/components/shared/SlidingHeader";
import { gameAtPath } from "@/lib/games";

/** Colors the shared header with the current game's own palette, without changing its layout. */
export default function GamesSkin({ children }: { children: React.ReactNode }) {
  const chrome = gameAtPath(usePathname())?.chrome;
  const skin = React.useMemo<HeaderSkin>(
    () =>
      chrome
        ? {
            bar: {
              "& .MuiAppBar-root": {
                bgcolor: chrome.background,
                color: chrome.text,
                borderBottom: `2px ${chrome.dividerStyle ?? "solid"} ${chrome.divider}`,
              },
            },
            tab: { bgcolor: chrome.background, color: chrome.text, borderColor: chrome.divider, "&:hover": { bgcolor: chrome.background } },
          }
        : {},
    [chrome],
  );
  return <HeaderSkinContext.Provider value={skin}>{children}</HeaderSkinContext.Provider>;
}
