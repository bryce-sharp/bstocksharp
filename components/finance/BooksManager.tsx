"use client";

import * as React from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SubmitButton from "@/components/shared/SubmitButton";
import {
  createBookAction,
  deleteBookAction,
  renameBookAction,
  setBookMembersAction,
  switchBookAction,
  type BookFormState,
} from "@/app/actions/books";

type BookRow = { id: number; name: string; members: number[]; hub: boolean };
/** The hub's shared login (named after the hub, like Home), when it has one, and whether it may open Finance at all. */
type HubLogin = { name: string; finance: boolean } | null;
type Person = { id: number; name: string; hasLogin: boolean };
type Open =
  | { kind: "new" }
  | { kind: "rename" | "members" | "delete"; book: BookRow }
  | null;

/** Checkboxes for the hub's people, named "members", plus the shared login when there is one. */
function PeopleChecks({
  people,
  checked,
  locked,
  hub,
  hubChecked,
}: {
  people: Person[];
  checked: number[];
  locked?: number | null;
  hub: HubLogin;
  hubChecked: boolean;
}) {
  return (
    <FormGroup>
      {people.map((p) => (
        <FormControlLabel
          key={p.id}
          control={
            <Checkbox
              name="members"
              value={p.id}
              defaultChecked={checked.includes(p.id) || p.id === locked}
              disabled={p.id === locked}
            />
          }
          label={
            <>
              {p.name}
              {p.id === locked ? " (you)" : p.hasLogin ? "" : " (no login)"}
            </>
          }
        />
      ))}
      {hub ? (
        <>
          <FormControlLabel
            control={<Checkbox name="hub" value="1" defaultChecked={hubChecked} />}
            label={`${hub.name} (shared login)`}
          />
          {!hub.finance ? (
            <Typography variant="caption" sx={{ color: "text.secondary", pl: 4 }}>
              {hub.name} cannot open Finance yet. Turn Finance on for it in Hub settings, People.
            </Typography>
          ) : null}
        </>
      ) : null}
    </FormGroup>
  );
}

export default function BooksManager({
  books,
  activeId,
  people,
  me,
  hub,
}: {
  books: BookRow[];
  activeId: number | null;
  people: Person[];
  /** The viewer's person; null for a login with none (it cannot make a book). */
  me: number | null;
  hub: HubLogin;
}) {
  const [open, setOpen] = React.useState<Open>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  const name = (id: number) => people.find((p) => p.id === id)?.name ?? "Someone";
  const show = (next: Open) => {
    setError(null);
    setOpen(next);
  };

  async function submit(result: Promise<BookFormState>) {
    const r = await result;
    if (r && "error" in r) setError(r.error);
    else setOpen(null);
  }

  return (
    <Stack spacing={1.5}>
      {books.map((b) => (
        <Paper key={b.id} variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }} component="span">
                {b.name}
              </Typography>
              {b.id === activeId ? <Chip size="small" label="In use" color="primary" sx={{ ml: 1 }} /> : null}
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {[...b.members.map(name), ...(b.hub && hub ? [hub.name] : [])].join(", ")}
              </Typography>
            </Box>
            {b.id !== activeId ? (
              <Button size="small" onClick={() => startTransition(() => switchBookAction(b.id))}>
                Use
              </Button>
            ) : null}
            {me !== null ? (
              <>
                <Tooltip title="Rename">
                  <IconButton size="small" aria-label={`Rename ${b.name}`} onClick={() => show({ kind: "rename", book: b })}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Members">
                  <IconButton size="small" aria-label={`Members of ${b.name}`} onClick={() => show({ kind: "members", book: b })}>
                    <GroupOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" aria-label={`Delete ${b.name}`} onClick={() => show({ kind: "delete", book: b })}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : null}
          </Box>
        </Paper>
      ))}

      {me !== null ? (
        <Box>
          <Button startIcon={<AddIcon />} onClick={() => show({ kind: "new" })}>
            New book
          </Button>
        </Box>
      ) : null}

      <Dialog open={open !== null} onClose={() => setOpen(null)} maxWidth="xs" fullWidth>
        {open?.kind === "new" ? (
          <form action={(fd) => submit(createBookAction(null, fd))}>
            <DialogTitle>New money book</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <TextField name="name" label="Name" placeholder="Business, Allowance…" autoFocus required />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  It starts empty. Who can open it:
                </Typography>
                <PeopleChecks people={people} checked={[]} locked={me} hub={hub} hubChecked={false} />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(null)} color="inherit">
                Cancel
              </Button>
              <SubmitButton variant="contained" pendingLabel="Creating…">
                Create book
              </SubmitButton>
            </DialogActions>
          </form>
        ) : open?.kind === "rename" ? (
          <form action={(fd) => submit(renameBookAction(open.book.id, null, fd))}>
            <DialogTitle>Rename {open.book.name}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <TextField name="name" label="Name" defaultValue={open.book.name} autoFocus required />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(null)} color="inherit">
                Cancel
              </Button>
              <SubmitButton variant="contained" pendingLabel="Saving…">
                Save
              </SubmitButton>
            </DialogActions>
          </form>
        ) : open?.kind === "members" ? (
          <form action={(fd) => submit(setBookMembersAction(open.book.id, null, fd))}>
            <DialogTitle>Who can open {open.book.name}</DialogTitle>
            <DialogContent>
              <Stack spacing={1} sx={{ pt: 1 }}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <PeopleChecks people={people} checked={open.book.members} hub={hub} hubChecked={open.book.hub} />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Each person opens the book from their own login, and sees and changes everything in it. People
                  without a login cannot open it until they get one. Keep at least one member who has a login.
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(null)} color="inherit">
                Cancel
              </Button>
              <SubmitButton variant="contained" pendingLabel="Saving…">
                Save
              </SubmitButton>
            </DialogActions>
          </form>
        ) : open?.kind === "delete" ? (
          <form action={(fd) => submit(deleteBookAction(open.book.id, null, fd))}>
            <DialogTitle>Delete {open.book.name}?</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Typography variant="body2">
                  This erases the book and everything in it: its accounts, balances, transactions, bills, pay and
                  tags. It cannot be undone. Type <strong>{open.book.name}</strong> to confirm.
                </Typography>
                <TextField name="name" label="Book name" autoFocus required autoComplete="off" />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpen(null)} color="inherit">
                Cancel
              </Button>
              <SubmitButton variant="contained" color="error" pendingLabel="Deleting…">
                Delete forever
              </SubmitButton>
            </DialogActions>
          </form>
        ) : null}
      </Dialog>
    </Stack>
  );
}
