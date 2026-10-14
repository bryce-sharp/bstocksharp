// The registry of games. Add a game here (plus its route under app/games) and
// it shows up in the /games gallery.
export type GameDef = {
  slug: string;
  name: string;
  tagline: string;
  href: string;
  /** 1200x630 preview in public/, also used as the page's social image. */
  image: string;
};

export const GAMES: GameDef[] = [
  {
    slug: "snug",
    name: "Snug",
    tagline: "A daily piece-fitting puzzle, stitched together out of yarn and patchwork.",
    href: "/games/snug",
    image: "/games/snug.png",
  },
];

export function getGame(slug: string): GameDef | undefined {
  return GAMES.find((g) => g.slug === slug);
}
