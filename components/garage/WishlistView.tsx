"use client";

import * as React from "react";
import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toggleWishlistPurchased, deleteWishlistItem } from "@/app/actions/wishlist";
import { formatMoney } from "@/lib/format";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import type { WishlistItem } from "@/lib/db/schema";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
      <Typography variant="h6" component="div">
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {label}
      </Typography>
    </Paper>
  );
}

const price = (v: string | null) => (v ? Number(v) : 0);

export default function WishlistView({
  items,
  vehicleId,
  editor,
}: {
  items: WishlistItem[];
  vehicleId: number;
  editor: boolean;
}) {
  const [optimisticItems, applyOptimistic] = React.useOptimistic(
    items,
    (state, update: { id: number; purchased: boolean }) =>
      state.map((i) =>
        i.id === update.id ? { ...i, purchased: update.purchased } : i,
      ),
  );
  const [, startTransition] = React.useTransition();

  function toggle(item: WishlistItem) {
    const purchased = !item.purchased;
    startTransition(async () => {
      applyOptimistic({ id: item.id, purchased });
      await toggleWishlistPurchased(item.id, vehicleId, purchased);
    });
  }

  const total = optimisticItems.reduce((s, i) => s + price(i.price), 0);
  const purchasedTotal = optimisticItems
    .filter((i) => i.purchased)
    .reduce((s, i) => s + price(i.price), 0);
  const remaining = total - purchasedTotal;

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: "repeat(3, 1fr)",
          mb: 2.5,
        }}
      >
        <Stat label="Wishlist" value={formatMoney(total)} />
        <Stat label="Purchased" value={formatMoney(purchasedTotal)} />
        <Stat label="Remaining" value={formatMoney(remaining)} />
      </Box>

      <Stack spacing={1.5}>
        {optimisticItems.map((i) => (
          <Paper key={i.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: "flex-start" }} spacing={1}>
              <Checkbox
                checked={i.purchased}
                onChange={() => toggle(i)}
                disabled={!editor}
                sx={{ p: 0.5, mt: "-2px" }}
                slotProps={{ input: { "aria-label": `Mark ${i.item} purchased` } }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      textDecoration: i.purchased ? "line-through" : "none",
                      color: i.purchased ? "text.secondary" : "text.primary",
                    }}
                  >
                    {i.item}
                  </Typography>
                  {i.priority === "high" ? (
                    <Chip size="small" variant="outlined" color="error" label="high" />
                  ) : null}
                  {i.rating ? (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {"★".repeat(i.rating)}
                    </Typography>
                  ) : null}
                </Stack>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {[i.brand, i.price ? formatMoney(i.price) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
                {i.notes ? (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}
                  >
                    {i.notes}
                  </Typography>
                ) : null}
              </Box>
              <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                {i.link ? (
                  <Tooltip title="Open link">
                    <IconButton
                      component="a"
                      href={i.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      aria-label="Open item link"
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
                {editor ? (
                  <>
                    <Tooltip title="Edit">
                      <IconButton
                        component={Link}
                        href={`/garage/${vehicleId}/wishlist/${i.id}/edit`}
                        size="small"
                        aria-label="Edit item"
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <DeleteIconButton
                      action={deleteWishlistItem.bind(null, i.id, vehicleId)}
                      confirmMessage={`Delete "${i.item}"?`}
                      label="Delete item"
                    />
                  </>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
