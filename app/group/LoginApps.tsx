"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import AppsIcon from "@mui/icons-material/Apps";
import SubmitButton from "@/components/shared/SubmitButton";
import { APPS } from "@/lib/apps";
import { setLoginAppsAction } from "@/app/actions/group";

/** Checkboxes for the hub's apps, named "apps", for the login forms here. */
export function AppChecks({ hubApps, checked }: { hubApps: string[]; checked: string[] }) {
  return (
    <FormGroup>
      {APPS.filter((a) => hubApps.includes(a.slug)).map((a) => (
        <FormControlLabel
          key={a.slug}
          control={<Checkbox name="apps" value={a.slug} defaultChecked={checked.includes(a.slug)} />}
          label={a.name}
        />
      ))}
    </FormGroup>
  );
}

// The owner's "Apps" control on a login: which of the hub's apps it may open.
// The server enforces it on every page and action of the other apps.
export default function LoginApps({
  accountId,
  username,
  hubApps,
  apps,
}: {
  accountId: number;
  username: string;
  hubApps: string[];
  /** The login's current list; null = every app the hub has. */
  apps: string[] | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const limited = apps !== null && apps.length < hubApps.length;

  return (
    <>
      <Button
        size="small"
        startIcon={<AppsIcon fontSize="small" />}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        sx={{ whiteSpace: "nowrap" }}
      >
        {limited ? `${apps.length} of ${hubApps.length} apps` : "All apps"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <form
          action={async (fd) => {
            const result = await setLoginAppsAction(accountId, null, fd);
            if (result && "error" in result) setError(result.error);
            else setOpen(false);
          }}
        >
          <DialogTitle>Apps {username} can open</DialogTitle>
          <DialogContent>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <AppChecks hubApps={hubApps} checked={apps ?? hubApps} />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Unchecked apps are hidden and blocked for this login, even by their address.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} color="inherit">
              Cancel
            </Button>
            <SubmitButton variant="contained" pendingLabel="Saving…">
              Save
            </SubmitButton>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
