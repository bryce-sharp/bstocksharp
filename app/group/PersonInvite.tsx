"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/SendOutlined";
import LinkIcon from "@mui/icons-material/Link";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import SubmitButton from "@/components/shared/SubmitButton";
import { inviteToPersonAction, revokeInviteAction } from "@/app/actions/group";

/** "Copy link" for a sign-in link, so the raw URL never has to be shown. */
export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      size="small"
      startIcon={copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      color={copied ? "success" : "primary"}
      sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy the sign-in link:", link);
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

// A person's sign-in link on their People card (owner only): whoever opens it
// makes a login that IS this person. Shows the waiting link once there is one.
export default function PersonInvite({
  profileId,
  name,
  origin,
  pending,
}: {
  profileId: number;
  name: string;
  origin: string;
  pending: { id: number; token: string; expiresInDays: number } | null;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (pending) {
    const link = `${origin}/join/${pending.token}`;
    return (
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, pl: { xs: 0, sm: 5.5 }, flexWrap: { xs: "wrap", sm: "nowrap" } }}
      >
        <LinkIcon fontSize="small" color="primary" />
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, minWidth: 0 }}>
          Sign-in link ready ({pending.expiresInDays} {pending.expiresInDays === 1 ? "day" : "days"} left)
        </Typography>
        <CopyLinkButton link={link} />
        <form action={revokeInviteAction.bind(null, pending.id)} style={{ flexShrink: 0 }}>
          <SubmitButton size="small" color="inherit" pendingLabel="…">
            Cancel
          </SubmitButton>
        </form>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 0.5, pl: { xs: 0, sm: 5.5 } }}>
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      <Button
        size="small"
        startIcon={<SendIcon fontSize="small" />}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await inviteToPersonAction(profileId);
          if ("error" in result) setError(result.error);
          setBusy(false);
        }}
      >
        {busy ? "Making a link…" : `Give ${name} a sign-in`}
      </Button>
    </Box>
  );
}
