"use client";

import dynamic from "next/dynamic";
import { DESK, ON_DARK_MUTED } from "./palette";

function Loading() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", borderRadius: 10, background: DESK, color: ON_DARK_MUTED, fontFamily: "'Courier New', monospace" }}>
      Sorting the mail...
    </div>
  );
}

// The game reads window and localStorage while rendering, so it only renders in the browser.
export const ReturnToSenderGame = dynamic(() => import("./ReturnToSender").then((m) => m.ReturnToSender), { ssr: false, loading: Loading });
export const ReturnToSenderLab = dynamic(() => import("./Lab").then((m) => m.Lab), { ssr: false, loading: Loading });
export const ReturnToSenderArt = dynamic(() => import("./art/ArtSheet").then((m) => m.ArtSheet), { ssr: false, loading: Loading });
