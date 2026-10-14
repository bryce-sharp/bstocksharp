// The registry of games. Add a game here (plus its route under app/games) and
// it shows up in the /games gallery.
/** A game's colors for the shared site header; the header's layout and controls never change. */
export type GameChrome = {
  background: string;
  text: string;
  divider: string;
  /** CSS border style for the divider, such as "dashed" for a stitched edge. */
  dividerStyle?: "solid" | "dashed" | "dotted";
};

export type GameDef = {
  slug: string;
  name: string;
  tagline: string;
  href: string;
  /** 1200x630 preview in public/, also used as the page's social image. */
  image: string;
  chrome?: GameChrome;
};

export const GAMES: GameDef[] = [
  {
    slug: "snug",
    name: "Snug",
    tagline: "A daily piece-fitting puzzle, stitched together out of yarn and patchwork.",
    href: "/games/snug",
    image: "/games/snug.png",
    chrome: { background: "#f4ead6", text: "#7b3b2e", divider: "#a35a42", dividerStyle: "dashed" },
  },
];

export function getGame(slug: string): GameDef | undefined {
  return GAMES.find((g) => g.slug === slug);
}

/** The game a /games path belongs to, if any. */
export function gameAtPath(pathname: string): GameDef | undefined {
  return GAMES.find((g) => pathname === g.href || pathname.startsWith(`${g.href}/`));
}
