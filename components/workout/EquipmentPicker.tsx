"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { EQUIPMENT } from "@/lib/workout";

// A checklist of equipment slugs backed by a single hidden input (JSON array),
// so it drops straight into any server-action <form> — same shape as the Apps
// checklist in EditProfileButton. Used two ways:
//   • Catalog editor: what gear an exercise REQUIRES (exercises.equipment).
//   • Person editor (Step 2): what gear someone OWNS (profiles.equipment).
export default function EquipmentPicker({
  name,
  defaultValue,
  label,
  helperText,
}: {
  name: string;
  defaultValue: string[];
  label: string;
  helperText: string;
}) {
  const [selected, setSelected] = React.useState<string[]>(defaultValue);

  function toggle(slug: string, on: boolean) {
    setSelected((prev) =>
      on ? [...new Set([...prev, slug])] : prev.filter((s) => s !== slug),
    );
  }

  return (
    <Box>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mb: 1 }}
      >
        {helperText}
      </Typography>
      <FormGroup>
        {EQUIPMENT.map((eq) => (
          <FormControlLabel
            key={eq.value}
            control={
              <Checkbox
                checked={selected.includes(eq.value)}
                onChange={(e) => toggle(eq.value, e.target.checked)}
              />
            }
            label={eq.label}
          />
        ))}
      </FormGroup>
    </Box>
  );
}
