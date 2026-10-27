import * as React from "react";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AppShell from "@/components/shared/AppShell";
import BooksManager from "@/components/finance/BooksManager";
import { peopleWithLogins, viewerBook } from "@/lib/books";
import { currentLogin } from "@/lib/hub-apps";
import { listProfiles } from "@/lib/queries/profiles";
import { getHubName } from "@/lib/queries/group";

export default async function FinanceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const book = await viewerBook();
  if (!book) {
    const login = await currentLogin();
    const me = login?.profileId ?? null;
    const people = me === null ? [] : await listProfiles();
    const withLogins = await peopleWithLogins(people.map((p) => p.id));
    return (
      <AppShell current="finance">
        <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
          <Typography variant="h5" component="h1" gutterBottom>
            No money book for this login
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {me !== null
              ? "Finance shows only the money books you are a member of. Ask a member to add you to theirs, or start your own."
              : login?.isHubLogin
                ? `${(await getHubName()) ?? "This shared login"} opens only the money books a member has ticked it on, in Finance, Manage books. None are ticked yet.`
                : "Finance shows the money books of the person your login is tied to. This login is not tied to a person, so it has none."}
          </Typography>
          {me !== null ? (
            <BooksManager
              books={[]}
              activeId={null}
              people={people.map((p) => ({ id: p.id, name: p.name, hasLogin: withLogins.has(p.id) }))}
              me={me}
              hub={null}
            />
          ) : null}
        </Container>
      </AppShell>
    );
  }
  return <AppShell current="finance">{children}</AppShell>;
}
