import * as React from "react";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AppShell from "@/components/shared/AppShell";
import { viewerBook } from "@/lib/books";
import { currentLogin } from "@/lib/hub-apps";

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const book = await viewerBook();
  if (!book) {
    const hasPerson = ((await currentLogin())?.profileId ?? null) !== null;
    return (
      <AppShell current="finance">
        <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
          <Typography variant="h5" component="h1" gutterBottom>
            No money book for this login
          </Typography>
          <Typography color="text.secondary">
            {hasPerson
              ? "Finance shows only the money books you are a member of, and you are not in one yet."
              : "Finance shows the money books of the person your login is tied to. This login is not tied to a person, so it has none."}
          </Typography>
        </Container>
      </AppShell>
    );
  }
  return <AppShell current="finance">{children}</AppShell>;
}
