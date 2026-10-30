"use client";

import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

// A small "how do I do this?" button. Tap it to pop the exercise description in
// a dialog. Reused on the daily workout view and (later) the live runner.
// Renders nothing when there's no description to show.
export default function ExerciseInfoButton({
  name,
  description,
  size = "small",
}: {
  name: string;
  description: string | null;
  size?: "small" | "medium";
}) {
  const [open, setOpen] = React.useState(false);
  if (!description) return null;

  return (
    <>
      <IconButton
        size={size}
        onClick={() => setOpen(true)}
        aria-label={`How to do ${name}`}
        color="primary"
      >
        <InfoOutlinedIcon fontSize={size === "small" ? "small" : "medium"} />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{name}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
