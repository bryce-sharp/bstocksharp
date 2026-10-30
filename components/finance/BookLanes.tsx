import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import { formatMoney } from "@/lib/format";
import type { BookLane } from "@/lib/queries/finance-between";

// Money between this book and the others it deals with (docs/finance/money-books.md):
// this month's activity, then where things stand overall. Shown only when used.
export default function BookLanes({ book, lanes }: { book: string; lanes: BookLane[] }) {
  if (!lanes.length) return null;
  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      {lanes.map((l) => {
        const lines = [
          [`Paid for ${l.name}`, l.ours.paidFor],
          [`${l.name} paid for ${book}`, l.theirs.paidFor],
          [`Sent to ${l.name}`, l.ours.sent],
          [`Came from ${l.name}`, l.theirs.sent],
          [`${l.name}'s income that landed in ${book}`, l.theirs.heldIncome],
          [`${book}'s income that landed in ${l.name}`, l.ours.heldIncome],
        ].filter((x): x is [string, number] => x[1] !== 0);
        const overall =
          l.net > 0
            ? `${book} has put ${formatMoney(l.net)} more into ${l.name} than it got back.`
            : l.net < 0
              ? `${l.name} has put ${formatMoney(-l.net)} more into ${book} than it got back.`
              : "Even.";
        return (
          <Paper key={l.bookId} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: lines.length ? 1 : 0.5 }}>
              <MenuBookOutlinedIcon fontSize="small" color="action" />
              <Typography sx={{ fontWeight: 600 }}>{l.name}</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                money between books
              </Typography>
            </Box>
            {lines.length ? (
              <Stack spacing={0.25} sx={{ mb: 1 }}>
                {lines.map(([label, amount]) => (
                  <Box key={label} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(amount)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5 }}>
                Nothing between them this month.
              </Typography>
            )}
            <Typography variant="body2">
              <strong>Overall:</strong> {overall}
            </Typography>
          </Paper>
        );
      })}
    </Stack>
  );
}
