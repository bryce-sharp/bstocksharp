import { ImageResponse } from "next/og";
import { getMe } from "@/lib/profile";
import { iconInitial, textOn } from "@/lib/icon";

// Dynamic browser-tab favicon: your color + initial. The root
// layout references it as `/profile-icon?v=<profileId>` — browsers cache favicons
// hard, so the changing URL is what forces a repaint when a different login signs in.
// Separate from apple-icon.tsx (the larger, iOS home-screen icon).
export const dynamic = "force-dynamic";

export async function GET() {
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
          fontSize: 34,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        {iconInitial(me?.name)}
      </div>
    ),
    { width: 48, height: 48 },
  );
}
