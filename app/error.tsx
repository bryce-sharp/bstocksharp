"use client";

import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";

// Generic fallback for unexpected errors anywhere in the app tree.
export default function AppError({
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
          Something went wrong
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          This is usually temporary. Please try again.
        </Typography>
        <Button variant="contained" onClick={reset}>
          Try again
        </Button>
      </Paper>
    </Container>
  );
}
