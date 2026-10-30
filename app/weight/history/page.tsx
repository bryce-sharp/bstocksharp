import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getActiveProfile } from "@/lib/profile";
import PrivateNotice from "@/components/shared/PrivateNotice";
import { canView } from "@/lib/sharing";
import { canEditProfile } from "@/lib/auth";
import { getWeighInsWithDelta } from "@/lib/queries/weight";
import WeightHistoryTable from "@/components/weight/WeightHistoryTable";

export const metadata = { title: "Weight · History" };

export default async function WeightHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile } = await searchParams;
  const active = await getActiveProfile(profile);

  if (!active) {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography sx={{ color: "text.secondary" }}>No profiles yet.</Typography>
      </Container>
    );
  }
  if (!(await canView(active, "weight"))) return <PrivateNotice title={`${active.name} keeps their weight private`} />;

  const [rows, editor] = await Promise.all([
    getWeighInsWithDelta(active.id),
    canEditProfile(active.id),
  ]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h3" component="h1">
          History
        </Typography>
        <Typography variant="h6" component="p" sx={{ color: "text.secondary", fontWeight: 400 }}>
          {active.name} · {rows.length} weigh-in{rows.length === 1 ? "" : "s"}
        </Typography>
      </Stack>

      <WeightHistoryTable profileId={active.id} rows={rows} editor={editor} />
    </Container>
  );
}
