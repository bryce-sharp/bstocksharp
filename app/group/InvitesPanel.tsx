"use client";

import * as React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import LinkIcon from "@mui/icons-material/Link";
import SubmitButton from "@/components/shared/SubmitButton";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import { CopyLinkButton } from "./PersonInvite";
import {
  createInviteAction,
  revokeInviteAction,
  type CreateInviteState,
} from "@/app/actions/group";

// Owner-only membership door (Phase E): mint invite links, see the live ones,
// revoke. Links expire in 7 days and are single-use unless "reusable" — a
// leaked old link is worthless either way.

export type InviteRow = {
  id: number;
  link: string; // full URL, origin baked in server-side
  note: string | null;
  household: boolean; // false = "their own hub"
  reusable: boolean;
  expiresInDays: number; // whole days, floor 0
};

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Tooltip title={copied ? "Copied!" : "Copy link"}>
      <IconButton
        size="small"
        aria-label="Copy invite link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt("Copy the invite link:", text);
          }
        }}
      >
        {copied ? (
          <CheckIcon fontSize="small" color="success" />
        ) : (
          <ContentCopyIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}

export default function InvitesPanel({
  origin,
  groupName,
  invites,
  canMintHubs,
}: {
  origin: string;
  groupName: string;
  invites: InviteRow[];
  /** Site admins may also invite someone to a new hub of their own. */
  canMintHubs: boolean;
}) {
  const [state, formAction] = React.useActionState<CreateInviteState, FormData>(
    createInviteAction,
    null,
  );
  const created =
    state && "token" in state ? `${origin}/join/${state.token}` : null;

  return (
    <Stack spacing={1.5}>
      {invites.map((inv) => (
        <Paper
          key={inv.id}
          variant="outlined"
          sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}
        >
          <LinkIcon sx={{ fontSize: "small" }} color="disabled" />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} component="span">
              {inv.note ?? "Invite link"}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {inv.household ? `joins ${groupName}` : "gets their own hub"}
              {" · "}
              {inv.reusable ? "reusable" : "single use"}
              {" · "}
              {inv.expiresInDays > 0
                ? `expires in ${inv.expiresInDays}d`
                : "expires today"}
            </Typography>
          </Box>
          <CopyButton text={inv.link} />
          <DeleteIconButton
            action={revokeInviteAction.bind(null, inv.id)}
            confirmMessage={`Revoke this invite link${inv.note ? ` (${inv.note})` : ""}? Anyone holding it won't be able to use it.`}
            label="Revoke invite"
          />
        </Paper>
      ))}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <form action={formAction}>
          <Stack spacing={2}>
            <Typography variant="subtitle2">Invite someone</Typography>
            {state && "error" in state ? (
              <Alert severity="error">{state.error}</Alert>
            ) : null}
            {created ? (
              <Alert severity="success" action={<CopyLinkButton link={created} />}>
                Invite link ready (valid 7 days). Copy it and send it to them.
              </Alert>
            ) : null}
            {canMintHubs ? (
              <TextField
                name="destination"
                label="They should"
                select
                size="small"
                fullWidth
                defaultValue="household"
                slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              >
                <option value="household">Join {groupName} (sees this hub)</option>
                <option value="own-hub">Get their own empty hub</option>
              </TextField>
            ) : (
              <input type="hidden" name="destination" value="household" />
            )}
            <TextField
              name="note"
              label="Note (optional)"
              size="small"
              fullWidth
              placeholder="e.g. for Val"
            />
            <FormControlLabel
              control={<Checkbox name="reusable" value="1" />}
              label="Reusable — the link works more than once (until it expires or you revoke it)"
            />
            <Box>
              <SubmitButton variant="outlined" pendingLabel="Creating…">
                Create invite link
              </SubmitButton>
            </Box>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
