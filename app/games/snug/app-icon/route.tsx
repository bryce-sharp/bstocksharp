import { ImageResponse } from "next/og";
import { BINDING, LINEN, YARNS } from "@/components/games/snug/palette";

// Snug's own home-screen and tab icon: a little nine-patch quilt in yarn colors on the binding,
// with a sewn-on "Snug" label at home-screen sizes (the tab size is too small to read it).
const ALLOWED_SIZES = new Set([64, 180, 192, 512]);
const PATCHES = ["teal", "mustard", "coral", "sky", "berry", "moss", "tangerine", "lavender", "denim"].map(
  (name) => YARNS.find((y) => y.name === name)!,
);
const RUST_THREAD = "#a35a42";

/** Caveat, the game's script face, fetched once per server instance; the label falls back to a plain font if it fails. */
let script: Promise<ArrayBuffer | null> | null = null;
function loadScript(): Promise<ArrayBuffer | null> {
  script ??= (async () => {
    try {
      const css = await (await fetch("https://fonts.googleapis.com/css2?family=Caveat:wght@700&text=Snug")).text();
      const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
      return url ? await (await fetch(url)).arrayBuffer() : null;
    } catch {
      return null;
    }
  })();
  return script;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Number(params.get("size"));
  if (!ALLOWED_SIZES.has(size)) return new Response("Unknown icon size", { status: 400 });
  // Maskable icons may be cropped to a circle, so the quilt stays inside the inner safe zone.
  const maskable = params.get("maskable") === "1";
  const inset = Math.round(size * (maskable ? 0.22 : 0.12));
  const gap = Math.max(1, Math.round(size * 0.025));
  const stitch = Math.max(1, Math.round(size * 0.012));
  const labelled = size >= 180;
  const font = labelled ? await loadScript() : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BINDING, padding: inset, position: "relative" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap, padding: gap, background: LINEN, borderRadius: size * 0.06 }}>
          {[0, 1, 2].map((row) => (
            <div key={row} style={{ flex: 1, display: "flex", gap }}>
              {[0, 1, 2].map((col) => {
                const yarn = PATCHES[row * 3 + col]!;
                return (
                  <div key={col} style={{ flex: 1, display: "flex", background: yarn.base, borderRadius: size * 0.02, padding: stitch * 2 }}>
                    <div style={{ flex: 1, border: `${stitch}px dashed ${LINEN}`, borderRadius: size * 0.012 }} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {labelled && (
          <div style={{ position: "absolute", top: 0, left: 0, width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                display: "flex",
                padding: `${size * 0.012}px ${size * 0.07}px ${size * 0.03}px`,
                background: LINEN,
                borderRadius: size * 0.02,
                border: `${stitch}px dashed ${RUST_THREAD}`,
                boxShadow: `0 ${size * 0.01}px ${size * 0.03}px rgba(40,20,10,.35)`,
                transform: "rotate(-4deg)",
                color: BINDING,
                fontFamily: font ? "Caveat" : "serif",
                fontWeight: 700,
                fontSize: size * (maskable ? 0.17 : 0.21),
                lineHeight: 1,
              }}
            >
              Snug
            </div>
          </div>
        )}
      </div>
    ),
    { width: size, height: size, fonts: font ? [{ name: "Caveat", data: font, weight: 700, style: "normal" }] : undefined },
  );
}
