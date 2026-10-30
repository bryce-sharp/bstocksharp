"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import Paper from "@mui/material/Paper";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Link from "@/components/shared/AppLink";
import {
  retagGroupAction,
  upsertNameAction,
  removeNameAction,
  renameGroupAction,
  deleteGroupAction,
} from "@/app/actions/finance-categories";
import type { MerchantGroup, MerchantGroupsView } from "@/lib/queries/finance-categories";
import type { Flow } from "@/lib/finance/cashflow";

const NEW = "__new__";

// A compact category dropdown; the group's current value is merged into the
// options so a stray category still shows. "New category…" prompts for one.
function CategorySelect({
  value,
  categories,
  disabled,
  label,
  onPick,
}: {
  value: string;
  categories: string[];
  disabled?: boolean;
  label: string;
  onPick: (category: string) => void;
}) {
  const opts = Array.from(new Set([...categories, value].filter(Boolean)));
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value || ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === NEW) {
          const name = window.prompt("New category name?")?.trim();
          if (name) onPick(name);
        } else if (v && v !== value) {
          onPick(v);
        }
      }}
      sx={{ minWidth: 150 }}
    >
      {opts.map((c) => (
        <MenuItem key={c} value={c}>
          {c}
        </MenuItem>
      ))}
      <MenuItem value={NEW}>
        <em>New category…</em>
      </MenuItem>
    </TextField>
  );
}

function GroupCard({
  flow,
  group,
  categories,
  editable,
  busy,
  run,
}: {
  flow: Flow;
  group: MerchantGroup;
  categories: string[];
  editable: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [addName, setAddName] = React.useState("");
  const [rename, setRename] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const shown = showAll ? group.merchants : group.merchants.slice(0, 12);

  return (
    <Accordion variant="outlined" disableGutters sx={{ "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5, pr: 1, width: "100%" }}
        >
          <Typography sx={{ fontWeight: 600 }}>{group.name}</Typography>
          <Chip size="small" label={group.category} sx={{ bgcolor: "action.selected" }} />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {group.txns} txns · {group.names.length} name{group.names.length === 1 ? "" : "s"}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            {editable ? (
              <CategorySelect
                label="Category"
                value={group.category}
                categories={categories}
                disabled={busy}
                onPick={(cat) => run(() => retagGroupAction(flow, group.name, cat))}
              />
            ) : null}
            {/* Every merchant this group catches, across all its spellings. */}
            <Button
              size="small"
              component={Link}
              href={`/finance/transactions?group=${encodeURIComponent(group.name)}${flow === "in" ? "&groupflow=in" : ""}`}
              endIcon={<ArrowForwardIcon fontSize="small" />}
            >
              See in History
            </Button>
          </Stack>

          {/* Match-names */}
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}
            >
              Match names
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75, mt: 0.75 }}>
              {group.names.map((n) => (
                <Chip
                  key={n.ruleId}
                  size="small"
                  variant="outlined"
                  label={n.pattern}
                  onDelete={
                    editable && group.names.length > 1
                      ? () => run(() => removeNameAction(n.ruleId))
                      : undefined
                  }
                />
              ))}
            </Stack>
            {editable ? (
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  placeholder={flow === "in" ? "Add a name (e.g. OUTPAVE)" : "Add a name (e.g. WAL-MART)"}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  sx={{ flexGrow: 1 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  disabled={busy || !addName.trim()}
                  onClick={() => {
                    const p = addName.trim();
                    setAddName("");
                    run(() => upsertNameAction(flow, group.name, group.category, p));
                  }}
                >
                  Add
                </Button>
              </Stack>
            ) : null}
          </Box>

          {/* Merchants caught */}
          <Box>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}
            >
              {flow === "in" ? "Sources" : "Merchants"} ({group.merchants.length})
            </Typography>
            <Stack spacing={0.25} sx={{ mt: 0.75 }}>
              {shown.map((m) => (
                <Stack key={m.merchant} direction="row" sx={{ justifyContent: "space-between" }} spacing={2}>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    {m.merchant}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {m.count}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            {group.merchants.length > 12 ? (
              <Button size="small" color="inherit" onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show less" : `Show all ${group.merchants.length}`}
              </Button>
            ) : null}
          </Box>

          {editable ? (
            <>
              <Divider />
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Rename group / merge into…"
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                  sx={{ flexGrow: 1, minWidth: 200 }}
                />
                <Button
                  size="small"
                  disabled={busy || !rename.trim()}
                  onClick={() => {
                    const nn = rename.trim();
                    setRename("");
                    run(() => renameGroupAction(flow, group.name, nn));
                  }}
                >
                  Rename
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <IconButton
                  size="small"
                  color="error"
                  disabled={busy}
                  aria-label={`Delete group ${group.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete the "${group.name}" group? Its transactions keep their category.`)) {
                      run(() => deleteGroupAction(flow, group.name));
                    }
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Renaming to an existing group merges them.
              </Typography>
            </>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

/** Groups bucketed by their tag, busiest tag first (groups keep their order). */
function sectionsByTag(groups: MerchantGroup[]) {
  const byTag = new Map<string, { tag: string; groups: MerchantGroup[]; txns: number }>();
  for (const g of groups) {
    const s = byTag.get(g.category) ?? { tag: g.category, groups: [], txns: 0 };
    s.groups.push(g);
    s.txns += g.txns;
    byTag.set(g.category, s);
  }
  return [...byTag.values()].sort((a, b) => b.txns - a.txns);
}

export default function MerchantGroups({
  view,
  editable,
}: {
  view: MerchantGroupsView;
  editable: boolean;
}) {
  const [isPending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<void>) => startTransition(() => void fn());
  const router = useRouter();
  const pathname = usePathname();
  const flow = view.flow;
  const noun = flow === "in" ? "source" : "merchant";

  return (
    <Stack spacing={2}>
      {/* Spending and income groups never mix: each side has its own tags. */}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={flow}
        onChange={(_, v: Flow | null) => {
          if (v && v !== flow) router.push(v === "in" ? `${pathname}?flow=in` : pathname);
        }}
        aria-label="Group type"
        sx={{ alignSelf: "flex-start" }}
      >
        <ToggleButton value="out" sx={{ px: 2 }}>
          Spending
        </ToggleButton>
        <ToggleButton value="in" sx={{ px: 2 }}>
          Income
        </ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        A <strong>group</strong> is a name, a tag, and the {noun}
        &ldquo;names&rdquo; that fall into it. Retagging a group re-tags every
        transaction it catches; the longest name always wins, so a specific
        override beats a broad group.
        {flow === "in" ? " Income groups only ever tag money coming in." : null}
      </Typography>

      {view.groups.length === 0 && flow === "in" ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No income groups yet. Assign a tag below (Paycheck, Interest…), or
            tag an income row on the History tab with &ldquo;Apply to all&rdquo;.
          </Typography>
        </Paper>
      ) : null}

      {/* Tag → group → match names: one collapsible section per tag, so all
          the Dining places sit together and each chain is still its own group. */}
      {sectionsByTag(view.groups).map((s) => (
        <Accordion
          key={s.tag}
          variant="outlined"
          disableGutters
          sx={{ "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", pr: 1, width: "100%" }}>
              <Typography variant="h6" component="h2">
                {s.tag}
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {s.groups.length} group{s.groups.length === 1 ? "" : "s"} · {s.txns} txns
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1}>
              {s.groups.map((g) => (
                <GroupCard
                  key={g.name}
                  flow={flow}
                  group={g}
                  categories={view.categories}
                  editable={editable}
                  busy={isPending}
                  run={run}
                />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}

      {view.ungrouped.length > 0 ? (
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Ungrouped {noun}s
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Not caught by any group yet. Assign a category to start a group for each.
          </Typography>
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {view.ungrouped.slice(0, 40).map((m) => (
              <Stack
                key={m.merchant}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    {m.merchant}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {m.count} txns
                  </Typography>
                </Box>
                {editable ? (
                  <CategorySelect
                    label="Assign"
                    value=""
                    categories={view.categories}
                    disabled={isPending}
                    onPick={(cat) => run(() => upsertNameAction(flow, m.merchant, cat, m.merchant))}
                  />
                ) : null}
              </Stack>
            ))}
          </Stack>
          {view.ungrouped.length > 40 ? (
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1.5 }}>
              +{view.ungrouped.length - 40} more — tag the rest from the History tab.
            </Typography>
          ) : null}
        </Paper>
      ) : null}
    </Stack>
  );
}
