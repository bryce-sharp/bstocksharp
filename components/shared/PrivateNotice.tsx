import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

/** Shown in place of a person's data this login may not see (lib/sharing, or a game played on their own login). */
export default function PrivateNotice({
  title,
  detail = "Pick someone else under Viewing, at the top.",
}: {
  title: string;
  detail?: string;
}) {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={1} alignItems="flex-start">
        <LockOutlinedIcon color="action" />
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
        <Typography color="text.secondary">{detail}</Typography>
      </Stack>
    </Container>
  );
}
