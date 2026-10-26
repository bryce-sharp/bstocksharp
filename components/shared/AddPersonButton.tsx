"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SubmitButton from "./SubmitButton";
import ColorSwatches, { PROFILE_SWATCHES } from "./ColorSwatches";
import { addPerson } from "@/app/actions/profile";
import { inviteToPersonAction } from "@/app/actions/group";
import { CopyLinkButton } from "@/app/group/PersonInvite";

// "Add person" on the /group page (moved out of the profile menu — the group
// page is the one place for household management). Creates a PROFILE (a person
// to track); the owner (`origin` set, for absolute links) can also give them a
// sign-in link at once, which makes a login that IS this person.
export default function AddPersonButton({ origin }: { origin: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState(PROFILE_SWATCHES[0]);
  const [link, setLink] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function openDialog() {
    setColor(PROFILE_SWATCHES[0]);
    setLink(null);
    setError(null);
    setOpen(true);
  }
  const close = () => setOpen(false);

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<PersonAddAlt1Icon />}
        onClick={openDialog}
      >
        Add person
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        {link ? (
          <>
            <DialogTitle>Send them their sign-in</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5}>
                <Alert severity="success" action={<CopyLinkButton link={link} />}>
                  Their sign-in link is ready.
                </Alert>
                <Typography variant="caption" color="text.secondary">
                  Copy it and send it to them. Opening it lets them pick a username and password, and that login is
                  this person. It works once, expires in 7 days, and also waits on their card under People.
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={close} variant="contained">
                Done
              </Button>
            </DialogActions>
          </>
        ) : (
          <form
            action={async (fd) => {
              const created = await addPerson(fd);
              if (created && origin && fd.get("signIn") != null) {
                const result = await inviteToPersonAction(created.id);
                if ("token" in result) return setLink(`${origin}/join/${result.token}`);
                return setError(result.error);
              }
              close();
            }}
          >
            <DialogTitle>Add a person</DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 0.5 }}>
                <TextField
                  name="name"
                  label="Name"
                  required
                  fullWidth
                  autoFocus
                  placeholder="e.g. Bryce"
                />
                <input type="hidden" name="color" value={color} />
                <ColorSwatches value={color} onChange={setColor} />
                {origin ? (
                  <FormControlLabel
                    control={<Checkbox name="signIn" />}
                    label="Give them their own sign-in (makes a link to send them)"
                  />
                ) : null}
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Typography variant="caption" color="text.secondary">
                  Without a sign-in, a person is open to everyone in this hub
                  (good for a young kid). With one, their stuff is theirs alone.
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={close} color="inherit">
                Cancel
              </Button>
              <SubmitButton variant="contained" pendingLabel="Adding…">
                Add person
              </SubmitButton>
            </DialogActions>
          </form>
        )}
      </Dialog>
    </>
  );
}
