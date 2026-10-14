import { BINDING, LINEN } from "@/components/games/snug/palette";
import { getGame } from "@/lib/games";

// Snug's own app setting, so "Add to Home Screen" names it Snug and opens straight into the game.
export function GET() {
  const snug = getGame("snug")!;
  return Response.json(
    {
      id: "/games/snug",
      name: snug.name,
      short_name: snug.name,
      description: snug.tagline,
      start_url: "/games/snug",
      scope: "/games/snug",
      display: "standalone",
      background_color: LINEN,
      theme_color: BINDING,
      icons: [
        { src: "/games/snug/app-icon?size=192", sizes: "192x192", type: "image/png" },
        { src: "/games/snug/app-icon?size=512", sizes: "512x512", type: "image/png" },
        { src: "/games/snug/app-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
