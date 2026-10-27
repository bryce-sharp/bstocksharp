"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SubmitButton from "@/components/shared/SubmitButton";
import { APPS } from "@/lib/apps";
import { setSharingAction } from "@/app/actions/profile";
import type { ShareRule, Sharing } from "@/lib/db/schema";

// Who can see a person's data in each personal app: everyone in the hub,
// chosen people, or just them (only once they have their own login).
export default function SharingButton({
  profileId,
  name,
  self,
  hasLogin,
  sharing,
  people,
  hubApps,
}: {
  profileId: number;
  name: string;
  /** Editing your own person: the wording says "your" and "Just me". */
  self: boolean;
  hasLogin: boolean;
  sharing: Sharing;
  /** The hub's other people, to pick from. */
  people: { id: number; name: string }[];
  hubApps: string[];
}) {
  const apps = APPS.filter((a) => a.personal && hubApps.includes(a.slug));
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [who, setWho] = React.useState<Record<string, ShareRule["who"]>>({});
  const limited = apps.some((a) => (sharing[a.slug]?.who ?? "everyone") !== "everyone");

  if (apps.length === 0) return null;

  return (
    <>
      <Button
        size="small"
        startIcon={<VisibilityOutlinedIcon fontSize="small" />}
        onClick={() => {
          setError(null);
          setWho(Object.fromEntries(apps.map((a) => [a.slug, sharing[a.slug]?.who ?? "everyone"])));
          setOpen(true);
        }}
        sx={{ whiteSpace: "nowrap" }}
      >
        {limited ? "Limited" : "Everyone"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <form
          action={async (fd) => {
            const result = await setSharingAction(profileId, fd);
            if ("error" in result) setError(result.error);
            else setOpen(false);
          }}
        >
          <DialogTitle>Who can see {self ? "your" : `${name}'s`} stuff</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              {error ? <Alert severity="error">{error}</Alert> : null}
              {apps.map((a) => (
                <FormControl key={a.slug}>
                  <FormLabel>{a.name}</FormLabel>
                  <RadioGroup
                    name={`${a.slug}.who`}
                    value={who[a.slug] ?? "everyone"}
                    onChange={(e) => setWho({ ...who, [a.slug]: e.target.value as ShareRule["who"] })}
                  >
                    <FormControlLabel value="everyone" control={<Radio size="small" />} label="Everyone in the hub" />
                    <FormControlLabel value="chosen" control={<Radio size="small" />} label="Chosen people" />
                    {who[a.slug] === "chosen" ? (
                      <FormGroup sx={{ pl: 4 }}>
                        {people.map((p) => (
                          <FormControlLabel
                            key={p.id}
                            control={
                              <Checkbox
                                size="small"
                                name={`${a.slug}.people`}
                                value={p.id}
                                defaultChecked={(sharing[a.slug]?.people ?? []).includes(p.id)}
                              />
                            }
                            label={p.name}
                          />
                        ))}
                      </FormGroup>
                    ) : null}
                    {hasLogin ? (
                      <FormControlLabel
                        value="me"
                        control={<Radio size="small" />}
                        label={self ? "Just me" : `Just ${name}`}
                      />
                    ) : null}
                  </RadioGroup>
                </FormControl>
              ))}
              <Typography variant="caption" color="text.secondary">
                This holds for the hub owner too. The shared hub login only sees what is shared with
                everyone.
              </Typography>
            </Stack>
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
