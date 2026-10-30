"use client";

import * as React from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AddIcon from "@mui/icons-material/Add";
import SubmitButton from "@/components/shared/SubmitButton";
import DeleteIconButton from "@/components/shared/DeleteIconButton";
import { formatDate } from "@/lib/format";
import { mintTokenAction, revokeTokenAction } from "@/app/actions/finance-tokens";

export type TokenRow = {
  id: number;
  label: string;
  scope: string;
  accountName: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};
export type TokenAccount = { id: number; name: string };

// Manage the API tokens the phone automations use. A minted secret is shown
// ONCE (copy it now) — the server only ever holds its hash.
export default function TokenManager({
  tokens,
  accounts,
}: {
  tokens: TokenRow[];
  accounts: TokenAccount[];
}) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [scope, setScope] = React.useState<"ingest" | "widget">("ingest");
  const [state, formAction] = React.useActionState(mintTokenAction, null);
  const [copied, setCopied] = React.useState(false);
  // Derive the just-minted secret straight from the action result (no
  // setState-in-effect). "Done" dismisses it by remembering which one we've
  // acknowledged; while it's showing, the add form stays hidden behind it.
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  const freshToken = state && "token" in state ? state.token : null;
  const minted = freshToken && freshToken !== dismissed ? freshToken : null;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
      >
        <Typography variant="h6">Connected devices</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          New token
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Tokens let your phone shortcuts send transactions in and read the budget
        widget. One per device or feed, so you can revoke a lost phone without
        touching the others.
      </Typography>

      {tokens.length === 0 ? (
        <Typography sx={{ color: "text.secondary" }}>No tokens yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {tokens.map((t) => (
            <Stack
              key={t.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography sx={{ flexGrow: 1, minWidth: 120 }} noWrap>
                {t.label}
              </Typography>
              <Chip
                size="small"
                color={t.scope === "ingest" ? "primary" : "default"}
                variant="outlined"
                label={t.scope === "ingest" ? "sends txns" : "reads widget"}
              />
              {t.accountName ? <Chip size="small" label={t.accountName} /> : null}
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {t.lastUsedAt ? `used ${formatDate(t.lastUsedAt)}` : "never used"}
              </Typography>
              <DeleteIconButton
                action={revokeTokenAction.bind(null, t.id)}
                confirmMessage={`Revoke "${t.label}"? That device stops working until you issue it a new token.`}
                label={`Revoke ${t.label}`}
              />
            </Stack>
          ))}
        </Stack>
      )}

      {/* Add-token form — hidden while the just-minted secret is showing. */}
      <Dialog open={addOpen && !minted} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <form action={formAction}>
          <DialogTitle>New token</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 0.5 }}>
              {state && "error" in state ? (
                <Alert severity="error">{state.error}</Alert>
              ) : null}
              <TextField
                name="label"
                label="Label"
                required
                autoFocus
                placeholder="e.g. Bryce's iPhone"
              />
              <TextField
                name="scope"
                label="Purpose"
                select
                value={scope}
                onChange={(e) => setScope(e.target.value as "ingest" | "widget")}
              >
                <MenuItem value="ingest">Send transactions in (a shortcut)</MenuItem>
                <MenuItem value="widget">Read the budget widget</MenuItem>
              </TextField>
              {scope === "ingest" ? (
                <TextField name="accountId" label="Stamp txns as (optional)" select defaultValue="">
                  <MenuItem value="">
                    <em>Unattributed</em>
                  </MenuItem>
                  {accounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAddOpen(false)} color="inherit">
              Cancel
            </Button>
            <SubmitButton variant="contained" pendingLabel="Creating…">
              Create
            </SubmitButton>
          </DialogActions>
        </form>
      </Dialog>

      {/* Show-once secret. Dismissing remembers this token + closes the form. */}
      <Dialog
        open={minted !== null}
        onClose={() => {
          setDismissed(freshToken);
          setAddOpen(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Copy your token now</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is shown once. We store only a hash — if you lose it, revoke and
            make a new one.
          </Alert>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <TextField
              value={minted ?? ""}
              fullWidth
              multiline
              slotProps={{ input: { readOnly: true, sx: { fontFamily: "monospace", fontSize: 13 } } }}
            />
            <Tooltip title={copied ? "Copied!" : "Copy"}>
              <IconButton onClick={() => minted && copy(minted)} aria-label="Copy token">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => {
              setDismissed(freshToken);
              setAddOpen(false);
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
