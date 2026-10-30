import Link from "@/components/shared/AppLink";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { listBookMembers, peopleWithLogins, viewerBook, viewerBooks } from "@/lib/books";
import { listProfiles } from "@/lib/queries/profiles";
import { allHubApps, currentLogin } from "@/lib/hub-apps";
import { listGroupMembers } from "@/lib/queries/groups";
import { getHubName } from "@/lib/queries/group";
import { db } from "@/lib/db";
import { books as booksTable } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import BooksManager from "@/components/finance/BooksManager";

export const metadata = { title: "Finance · Books" };

// Money books (docs/finance/money-books.md): the books this login can see,
// their members, and a new one. Any member manages a book.
export default async function BooksPage() {
  const [books, active, people, login, members, hubApps, hubName] = await Promise.all([
    viewerBooks(),
    viewerBook(),
    listProfiles(),
    currentLogin(),
    listGroupMembers(),
    allHubApps(),
    getHubName(),
  ]);
  const withLogins = await peopleWithLogins(people.map((p) => p.id));
  const hubFlags = books.length
    ? await db.select({ id: booksTable.id, hubLogin: booksTable.hubLogin }).from(booksTable).where(inArray(booksTable.id, books.map((b) => b.id)))
    : [];
  const rows = await Promise.all(
    books.map(async (b) => ({
      id: b.id,
      name: b.name,
      members: (await listBookMembers(b.id)).map((m) => m.id),
      hub: hubFlags.find((f) => f.id === b.id)?.hubLogin ?? false,
    })),
  );
  const hubLogin = members.find((m) => m.isHubLogin);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      <Button component={Link} href="/finance" startIcon={<ArrowBackIcon />} color="inherit" sx={{ mb: 2 }}>
        Back to budget
      </Button>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Money books
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Each book is its own set of money: its accounts, bills, budget and tags. Only its members can see
          it, and any member can rename it or change who is in it.
        </Typography>
      </Stack>
      <BooksManager
        books={rows}
        activeId={active?.id ?? null}
        people={people.map((p) => ({ id: p.id, name: p.name, hasLogin: withLogins.has(p.id) }))}
        me={login?.profileId ?? null}
        hub={hubLogin ? { name: hubName ?? "Hub", finance: (hubLogin.apps ?? hubApps).includes("finance") } : null}
      />
    </Container>
  );
}
