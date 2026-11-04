"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { UNIT_SYSTEMS, type UnitSystem } from "@/lib/recipe-units";
import { color } from "./tokens";

/** As written, US or Metric, for how a recipe's amounts read. */
export default function UnitsSwitch({ value, onChange }: { value: UnitSystem; onChange: (units: UnitSystem) => void }) {
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, next: UnitSystem | null) => next && onChange(next)} aria-label="Units">
      {UNIT_SYSTEMS.map((u) => (
        <ToggleButton key={u.value} value={u.value} sx={{ px: 1.25, py: 0.25, fontSize: 13, textTransform: "none", borderColor: color.rule }}>
          {u.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
