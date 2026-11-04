"use client";

import Chip, { type ChipProps } from "@mui/material/Chip";
import Link from "@/components/shared/AppLink";
import { color } from "./tokens";

/** A recipe tag: quiet when it is only a label, sage when it is a filter that is on, a link with `href`. */
export default function TagChip({ selected, href, sx, ...props }: ChipProps & { selected?: boolean; href?: string }) {
  const style = {
    borderColor: selected ? color.accent : color.rule,
    bgcolor: selected ? color.accent : "transparent",
    color: selected ? color.onAccent : color.muted,
    "&.MuiChip-clickable:hover": { bgcolor: selected ? color.accentDeep : color.highlight },
    "& .MuiChip-icon": { color: "inherit" },
    ...sx,
  };
  if (href) return <Chip label={props.label} component={Link} href={href} clickable sx={style} />;
  return <Chip {...props} sx={style} />;
}
