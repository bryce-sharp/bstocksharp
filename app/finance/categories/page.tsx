import Link from "@/components/shared/AppLink";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { getSession } from "@/lib/session";
import { isEditor } from "@/lib/auth";
import { getMerchantGroupsForBook } from "@/lib/queries/finance-categories";
import MerchantGroups from "@/components/finance/MerchantGroups";
import { requireBook } from "@/lib/books";

export const metadata = { title: "Categories" };

// F4d — the merchant-groups management page. A group is a NAME + a tag +
// several match-names; retag a whole group at once, fold names together, and
// mop up the ungrouped tail. `?flow=in` shows the income side (Paycheck,
// Interest…), whose groups never touch spending.
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const session = await getSession();
  if (session === null) redirect("/login");

  const flow = (await searchParams).flow === "in" ? "in" : "out";
  const [view, editor] = await Promise.all([
    getMerchantGroupsForBook(await requireBook(), flow),
    isEditor(),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Button
        component={Link}
        href="/finance"
        startIcon={<ArrowBackIcon />}
        color="inherit"
        sx={{ mb: 2 }}
      >
        Back to budget
      </Button>

      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h3" component="h1">
          Categories
        </Typography>
        <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400 }}>
          Group your merchants and income sources, and tag each group
        </Typography>
      </Stack>

      <MerchantGroups view={view} editable={editor} />
    </Container>
  );
}
