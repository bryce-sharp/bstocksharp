"use client";

import dynamic from "next/dynamic";
import { SNUG_FONTS } from "./fonts";
import { BINDING, LINEN } from "./quilt";

function Loading() {
  return (
    <div className={SNUG_FONTS} style={{ minHeight: "70vh", display: "grid", placeItems: "center", borderRadius: 22, background: LINEN }}>
      <span style={{ fontFamily: "var(--snug-font-script), cursive", fontSize: 64, fontWeight: 700, color: BINDING, opacity: 0.7 }}>Snug</span>
    </div>
  );
}

// Snug reads window and localStorage while rendering, so it only renders in the browser.
export const SnugGame = dynamic(() => import("./Snug").then((m) => m.Snug), { ssr: false, loading: Loading });
export const SnugArt = dynamic(() => import("./ArtSheet").then((m) => m.SnugArtSheet), { ssr: false, loading: Loading });
export const SnugLab = dynamic(() => import("./MonthLab").then((m) => m.MonthLab), { ssr: false, loading: Loading });
export const SnugSoundLab = dynamic(() => import("./SoundLab").then((m) => m.SoundLab), { ssr: false, loading: Loading });
