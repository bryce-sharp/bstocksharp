import { ImageResponse } from "next/og";
import { getMe } from "@/lib/profile";
import { iconInitial, textOn } from "@/lib/icon";

// iOS "Add to Home Screen" icon (generated to PNG at request time). Next wires
// this up as <link rel="apple-touch-icon">. It renders your color + initial,
// so whoever adds the app to their home screen gets their own color baked in. iOS snapshots this at add-time and never refetches,
// so it's per-device, not live — see the profile-color-theming notes.
export const dynamic = "force-dynamic";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          fontSize: 120,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        {iconInitial(me?.name)}
      </div>
    ),
    size,
  );
}
