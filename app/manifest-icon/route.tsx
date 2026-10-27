import { ImageResponse } from "next/og";
import { getMe } from "@/lib/profile";
import { iconInitial, textOn } from "@/lib/icon";

// PWA manifest icons (referenced from app/manifest.ts): your
// color + initial, generated to PNG at request time — same family as
// app/apple-icon.tsx (iOS) and /profile-icon (favicon). `?size=` picks the
// dimension; `?maskable=1` shrinks the glyph into the maskable safe zone (the
// OS may crop the square to a circle, so keep content in the inner ~80%).
export const dynamic = "force-dynamic";

// Only the sizes the manifest actually asks for — not an arbitrary image API.
const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Number(params.get("size"));
  if (!ALLOWED_SIZES.has(size)) {
    return new Response("Unknown icon size", { status: 400 });
  }
  const maskable = params.get("maskable") === "1";

  const me = await getMe();
  const bg = me?.color ?? "#4caf7d";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: textOn(bg),
          // Matches apple-icon's glyph-to-canvas ratio; maskable stays inside
          // the crop-safe zone.
          fontSize: Math.round(size * (maskable ? 0.45 : 0.66)),
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        {iconInitial(me?.name)}
      </div>
    ),
    { width: size, height: size },
  );
}
