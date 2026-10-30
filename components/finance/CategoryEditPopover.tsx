"use client";

import * as React from "react";
import Popover from "@mui/material/Popover";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

// The inline category tagger. freeSolo so you can pick an existing category OR
// type a brand-new one; the switch turns a one-off tag into a merchant rule
// ("always tag this merchant as ___") — the learning path.
export default function CategoryEditPopover({
  anchorEl,
  merchant,
  current,
  categories,
  placeholder = "Groceries, Dining…",
  onSave,
  onClose,
}: {
  anchorEl: HTMLElement;
  merchant: string | null;
  current: string | null;
  categories: string[];
  placeholder?: string;
  onSave: (category: string | null, applyToMerchant: boolean) => void;
  onClose: () => void;
}) {
  const [input, setInput] = React.useState(current ?? "");
  const [applyAll, setApplyAll] = React.useState(false);

  return (
    <Popover
      open
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    >
      <Box sx={{ p: 2, width: 280 }}>
        <Autocomplete
          freeSolo
          options={categories}
          inputValue={input}
          onInputChange={(_, v) => setInput(v)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Tag"
              autoFocus
              placeholder={placeholder}
            />
          )}
        />
        {merchant ? (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                size="small"
                checked={applyAll}
                onChange={(e) => setApplyAll(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                Apply to all &ldquo;{merchant}&rdquo;
              </Typography>
            }
          />
        ) : null}
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", mt: 1.5 }}>
          <Button size="small" color="inherit" onClick={() => onSave(null, false)}>
            Clear
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => onSave(input.trim() ? input.trim() : null, applyAll)}
          >
            Save
          </Button>
        </Stack>
      </Box>
    </Popover>
  );
}
