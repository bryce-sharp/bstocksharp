// The basket the patches wait in.

import type { CSSProperties } from "react";
import { StitchBorder } from "./stitches";

/** Absolutely positioned by the caller through `style`; the patches are drawn over it. */
export function Basket({ style }: { style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 18,
        background: "repeating-linear-gradient(45deg, #d8b98d 0 6px, #cfae80 6px 12px), #d8b98d",
        boxShadow: "inset 0 2px 10px rgba(80,45,20,.35)",
        ...style,
      }}
    >
      <StitchBorder inset={7} radius={12} color="#8a5a3c" width={2} stitch={6} gap={4} seed="basket" />
    </div>
  );
}
