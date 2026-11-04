import { color } from "./tokens";

/** Five stars filled to `value`, with faint empty ones; the system font keeps them the same size in every look. */
export default function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span
      role="img"
      aria-label={`${Math.round(value * 10) / 10} of 5 stars`}
      style={{ position: "relative", display: "inline-block", fontFamily: "system-ui, sans-serif", fontSize: size, lineHeight: 1, letterSpacing: 1, whiteSpace: "nowrap" }}
    >
      <span aria-hidden style={{ color: `color-mix(in srgb, ${color.muted} 30%, transparent)` }}>★★★★★</span>
      <span aria-hidden style={{ position: "absolute", inset: 0, width: `${(value / 5) * 100}%`, overflow: "hidden", color: color.star }}>
        ★★★★★
      </span>
    </span>
  );
}
