"use client";

import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";

// Graceful fallback for any error thrown while rendering a Finance page (e.g. a
// database hiccup). Renders inside the Finance layout, so the header stays put.
export default function FinanceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <ErrorOutlineIcon color="warning" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          Couldn&apos;t load your finances
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          Something went wrong reaching your data — usually a temporary database
          hiccup. Your numbers are safe; give it a moment and try again.
        </Typography>
        <Button variant="contained" onClick={reset}>
          Try again
        </Button>
      </Paper>
    </Container>
  );
}
