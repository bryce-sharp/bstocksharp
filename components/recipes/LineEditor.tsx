"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import { splitPasted } from "@/lib/recipes";
import { blankLine, type Line } from "./lines";
import { color } from "./tokens";

/**
 * A list of lines typed like a list: Enter starts the next line, Backspace on an empty line removes it, and
 * pasting several lines splits them. Keys stay with their lines, so ids survive every edit.
 */
export default function LineEditor({
  lines,
  onChange,
  kind,
}: {
  lines: Line[];
  onChange: (lines: Line[]) => void;
  kind: "ingredient" | "step";
}) {
  const inputs = React.useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  // The line to focus once the list has re-rendered with it.
  const focusNext = React.useRef<string | null>(null);
  const setFocusKey = (key: string) => {
    focusNext.current = key;
  };

  React.useEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    focusNext.current = null;
    const el = inputs.current.get(key);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });

  const shown = lines;
  const set = (i: number, patch: Partial<Line>) => onChange(shown.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const insertAfter = (i: number, added: Line[]) => {
    onChange([...shown.slice(0, i + 1), ...added, ...shown.slice(i + 1)]);
    setFocusKey(added[added.length - 1]!.key);
  };
  const remove = (i: number) => {
    const next = shown.filter((_, j) => j !== i);
    onChange(next);
    const before = shown[i - 1] ?? next[0];
    if (before) setFocusKey(before.key);
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= shown.length) return;
    const next = [...shown];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  let number = 0;
  return (
    <Box>
      {shown.map((line, i) => {
        if (!line.heading) number++;
        const name = line.heading ? "Heading" : kind === "step" ? `Step ${number}` : `Ingredient ${number}`;
        return (
          <Box key={line.key} sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mb: 1 }}>
            {kind === "step" && (
              <Box aria-hidden sx={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, color: color.accent, fontSize: 19, width: 26, pt: "9px", textAlign: "right", flex: "none" }}>
                {number}
              </Box>
            )}
            <TextField
              fullWidth
              size="small"
              multiline={kind === "step"}
              value={line.text}
              placeholder={line.heading ? "Heading, like For the sauce, or blank to end the one above" : kind === "step" ? "What to do" : "1 cup (125 g) flour"}
              inputRef={(el: HTMLInputElement | HTMLTextAreaElement | null) => {
                if (el) inputs.current.set(line.key, el);
                else inputs.current.delete(line.key);
              }}
              onChange={(e) => set(i, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  insertAfter(i, [blankLine()]);
                } else if (e.key === "Backspace" && line.text === "" && shown.length > 1) {
                  e.preventDefault();
                  remove(i);
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (!/\n/.test(pasted.trim())) return;
                const parts = splitPasted(pasted);
                if (!parts.length) return;
                e.preventDefault();
                // An empty line takes the first pasted line; the rest follow it.
                const fill = line.text.trim() === "";
                const base = fill ? shown.map((l, j) => (j === i ? { ...l, text: parts[0]! } : l)) : shown;
                const added = (fill ? parts.slice(1) : parts).map((text) => ({ ...blankLine(), text }));
                onChange([...base.slice(0, i + 1), ...added, ...base.slice(i + 1)]);
                setFocusKey((added[added.length - 1] ?? base[i]!).key);
              }}
              slotProps={{ htmlInput: { "aria-label": name } }}
              sx={{
                "& .MuiOutlinedInput-root": { bgcolor: color.surface },
                ...(line.heading ? { "& .MuiInputBase-input": { fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, fontSize: 13 } } : {}),
              }}
            />
            <Box sx={{ display: "flex", flex: "none" }}>
              <IconButton size="small" aria-label={`Move ${name.toLowerCase()} up`} disabled={i === 0} onClick={() => move(i, -1)} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label={`Move ${name.toLowerCase()} down`} disabled={i === shown.length - 1} onClick={() => move(i, 1)} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label={`Remove ${name.toLowerCase()}`} onClick={() => (shown.length > 1 ? remove(i) : set(i, { text: "" }))}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        );
      })}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, pl: kind === "step" ? "30px" : 0 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => insertAfter(shown.length - 1, [blankLine()])}>
          {kind === "step" ? "Add step" : "Add ingredient"}
        </Button>
        {kind === "ingredient" && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => insertAfter(shown.length - 1, [blankLine(true)])}>
            Add heading
          </Button>
        )}
      </Box>
    </Box>
  );
}
