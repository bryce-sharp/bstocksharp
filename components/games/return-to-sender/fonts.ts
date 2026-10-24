import { Oswald, Special_Elite } from "next/font/google";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", variable: "--rts-font-display" });
const type = Special_Elite({ subsets: ["latin"], weight: "400", display: "swap", variable: "--rts-font-type" });

/** Put on Return to Sender's outermost element so everything inside gets the fonts. */
export const RTS_FONTS = `${display.variable} ${type.variable}`;
export const DISPLAY = "var(--rts-font-display), 'Arial Narrow', Impact, sans-serif";
/** The clerk's typewriter. It has one weight, so bold text is drawn heavier by the browser. */
export const TYPE = "var(--rts-font-type), 'Courier New', monospace";
