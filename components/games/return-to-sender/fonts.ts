import { Courier_Prime, Oswald } from "next/font/google";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--rts-font-display" });
const type = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], display: "swap", variable: "--rts-font-type" });

/** Put on Return to Sender's outermost element so everything inside gets the fonts. */
export const RTS_FONTS = `${display.variable} ${type.variable}`;
export const DISPLAY = "var(--rts-font-display), 'Arial Narrow', Impact, sans-serif";
export const TYPE = "var(--rts-font-type), 'Courier New', monospace";
