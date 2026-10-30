"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import ColorSwatches, { PROFILE_SWATCHES } from "./ColorSwatches";
import SubmitButton from "./SubmitButton";
import DeleteProfileButton from "./DeleteProfileButton";
import {
  updateProfile,
  deactivateProfile,
  reactivateProfile,
} from "@/app/actions/profile";
import { APPS } from "@/lib/apps";

// Manage one person: edit name/color/apps up top, with lifecycle actions
// (deactivate/reactivate, delete) tucked into a "Danger zone" at the bottom so
// the /group row stays calm and the destructive actions aren't one-click. The
// danger-zone actions are buttons (not forms), so the whole dialog is a single
// <form> for the editable fields — no invalid nested forms.
export default function EditProfileButton({
  profileId,
  profileName,
  profileColor,
  profileHiddenApps,
  archived,
  canDeactivate,
  heirs,
  offeredApps,
}: {
  profileId: number;
  profileName: string;
  profileColor: string | null;
  profileHiddenApps: string[];
  archived: boolean;
  canDeactivate: boolean;
  heirs: { id: number; name: string }[];
  /** The apps this hub has (lib/hub-apps); omitted means every app. */
  offeredApps?: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState(profileColor ?? PROFILE_SWATCHES[0]);
  const [hidden, setHidden] = React.useState<string[]>(profileHiddenApps);
  const [pending, startTransition] = React.useTransition();

  function openDialog() {
    // Reset to the current values each time (the dialog remounts on open).
    setColor(profileColor ?? PROFILE_SWATCHES[0]);
    setHidden(profileHiddenApps);
    setOpen(true);
  }

  const close = () => setOpen(false);
  const offered = offeredApps ? APPS.filter((a) => offeredApps.includes(a.slug)) : APPS;
  const visibleCount = offered.filter((a) => !hidden.includes(a.slug)).length;

  function toggleApp(slug: string, visible: boolean) {
    setHidden((prev) =>
      visible ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function runLifecycle(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      close();
    });
  }

  return (
    <>
      <Tooltip title={`Manage ${profileName}`}>
        <IconButton
          size="small"
          onClick={openDialog}
          aria-label={`Manage ${profileName}`}
        >
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs">
        <form
          action={async (fd) => {
            await updateProfile(profileId, fd);
            close();
          }}
        >
          <DialogTitle>Edit {profileName}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 0.5 }}>
              <TextField
                name="name"
                label="Name"
                required
                fullWidth
                autoFocus
                defaultValue={profileName}
              />
              <input type="hidden" name="color" value={color} />
              <ColorSwatches value={color} onChange={setColor} />

              <input
                type="hidden"
                name="hiddenApps"
                value={JSON.stringify(hidden)}
              />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 0.5 }}
                >
                  Apps
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block", mb: 1 }}
                >
                  Uncheck an app to hide it from this person&apos;s hub.
                </Typography>
                <FormGroup>
                  {offered.map((a) => {
                    const visible = !hidden.includes(a.slug);
                    // Never let them hide the last visible app.
                    const lockOn = visible && visibleCount === 1;
                    return (
                      <FormControlLabel
                        key={a.slug}
                        control={
                          <Checkbox
                            checked={visible}
                            disabled={lockOn}
                            onChange={(e) =>
                              toggleApp(a.slug, e.target.checked)
                            }
                          />
                        }
                        label={
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center" }}
                          >
                            <a.Icon fontSize="small" sx={{ color: a.accent }} />
                            <span>{a.name}</span>
                          </Stack>
                        }
                      />
                    );
                  })}
                </FormGroup>
              </Box>

              {/* Danger zone: reversible deactivate + irreversible delete.
                  Buttons (type=button) — they don't submit the edit form. */}
              <Divider />
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: "error.main", display: "block", mb: 1 }}
                >
                  Danger zone
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", flexWrap: "wrap" }}
                >
                  {archived ? (
                    <Button
                      size="small"
                      disabled={pending}
                      startIcon={
                        pending ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : null
                      }
                      onClick={() =>
                        runLifecycle(() => reactivateProfile(profileId))
                      }
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Tooltip
                      title={
                        canDeactivate
                          ? ""
                          : "Can't deactivate the only active person."
                      }
                    >
                      <Box component="span">
                        <Button
                          size="small"
                          color="inherit"
                          disabled={pending || !canDeactivate}
                          startIcon={
                            pending ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : null
                          }
                          onClick={() =>
                            runLifecycle(() => deactivateProfile(profileId))
                          }
                        >
                          Deactivate
                        </Button>
                      </Box>
                    </Tooltip>
                  )}

                  <DeleteProfileButton
                    profileId={profileId}
                    profileName={profileName}
                    heirs={heirs}
                    onDeleted={close}
                  />
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={close} color="inherit" disabled={pending}>
              Cancel
            </Button>
            <SubmitButton
              variant="contained"
              pendingLabel="Saving…"
              disabled={pending}
            >
              Save changes
            </SubmitButton>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
