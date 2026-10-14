import { Caveat, Fredoka } from "next/font/google";

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"], display: "swap", variable: "--snug-font-script" });
const body = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--snug-font-body" });

/** Put on Snug's outermost element so everything inside, modals included, gets the fonts. */
export const SNUG_FONTS = `${script.variable} ${body.variable}`;
