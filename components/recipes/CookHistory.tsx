"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { RecipeLogEntry } from "@/lib/queries/recipes";
import { shortDay } from "@/lib/recipes";
import Stars from "./Stars";
import { color } from "./tokens";

/** The cook log, newest first, with a marker where each version of the recipe begins. */
export default function CookHistory({
  logs,
  version,
  today,
  canEdit,
  onEdit,
}: {
  logs: RecipeLogEntry[];
  version: number;
  today: string;
  canEdit: (profileId: number) => boolean;
  onEdit: (entry: RecipeLogEntry) => void;
}) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {logs.map((l, i) => {
        const versionStarts = logs[i + 1] === undefined ? false : logs[i + 1]!.recipeVersion !== l.recipeVersion;
        return (
          <React.Fragment key={l.id}>
            <Box component="li" sx={{ display: "flex", gap: 1.5, py: 1.25, borderTop: i ? `1px solid ${color.rule}` : "none", opacity: l.recipeVersion === version ? 1 : 0.7 }}>
              <Box aria-hidden sx={{ flex: "none", width: 10, height: 10, borderRadius: "50%", bgcolor: l.color ?? color.muted, mt: "6px" }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{l.person}</Typography>
                  <Typography variant="body2" sx={{ color: color.muted }}>
                    {shortDay(l.cookedOn, today)}
                    {l.servings ? ` · ${l.servings} servings` : ""}
                  </Typography>
                  {l.rating !== null && (
                    <Box sx={{ opacity: l.counted ? 1 : 0.45 }}>
                      <Stars value={l.rating} size={14} />
                    </Box>
                  )}
                  {!l.counted && (
                    <Typography variant="body2" sx={{ fontWeight: 600, color: color.second }}>
                      Something went wrong
                    </Typography>
                  )}
                </Box>
                {l.notes && <Typography sx={{ fontSize: 14.5, whiteSpace: "pre-line", mt: 0.25 }}>{l.notes}</Typography>}
              </Box>
              {canEdit(l.profileId) && (
                <IconButton size="small" aria-label={`Change ${l.person}'s cook on ${shortDay(l.cookedOn, today)}`} onClick={() => onEdit(l)} sx={{ alignSelf: "flex-start" }}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            {versionStarts && (
              <Box component="li" sx={{ py: 0.75, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: color.second, borderTop: `1px dashed ${color.second}` }}>
                Version {l.recipeVersion} starts here
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
