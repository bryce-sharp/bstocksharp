// Dev pages: tools for building the site (art sheets, labs). They exist only when
// the app runs locally (`next dev`); a production build answers them with "not
// found". Plain constants, so the app menu can list them on the client too.

/** True when running `next dev` on your own machine. */
export const isDevSite = process.env.NODE_ENV !== "production";

export type DevPage = { href: string; name: string; about: string };

export const DEV_PAGES: DevPage[] = [
  { href: "/games/snug/art", name: "Snug art sheet", about: "Every Snug drawing on one page" },
  { href: "/games/snug/lab", name: "Snug month lab", about: "Sew any month outline on a sample month" },
  { href: "/games/snug/lab/sounds", name: "Snug sound lab", about: "Every sound choice, side by side" },
];
