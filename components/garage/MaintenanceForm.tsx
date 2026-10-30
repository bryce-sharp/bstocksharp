import Link from "@/components/shared/AppLink";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import SubmitButton from "@/components/shared/SubmitButton";
import NumberField from "@/components/shared/NumberField";
import ServiceField from "@/components/garage/ServiceField";
import type { MaintenanceRecord } from "@/lib/db/schema";

const CATEGORY_OPTIONS: [string, string][] = [
  ["", "—"],
  ["maintenance", "Maintenance"],
  ["repair", "Repair"],
  ["upgrade", "Upgrade"],
  ["cosmetic", "Cosmetic"],
  ["safety", "Safety"],
];

export default function MaintenanceForm({
  action,
  record,
  submitLabel,
  cancelHref,
  serviceOptions = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  record?: MaintenanceRecord | null;
  submitLabel: string;
  cancelHref: string;
  serviceOptions?: string[];
}) {
  const r = record ?? null;

  return (
    <form action={action}>
      <Stack spacing={2.5}>
        <ServiceField defaultValue={r?.serviceType} options={serviceOptions} />

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="serviceDate"
            label="Date"
            type="date"
            required
            fullWidth
            defaultValue={r?.serviceDate ?? ""}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            name="category"
            label="Category"
            select
            fullWidth
            defaultValue={r?.category ?? ""}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          >
            {CATEGORY_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </TextField>
          <NumberField name="mileage" label="Mileage" defaultValue={r?.mileage} />
          <NumberField
            name="cost"
            label="Cost"
            prefix="$"
            decimalScale={2}
            defaultValue={r?.cost}
          />
          <TextField
            name="vendor"
            label="Vendor / shop"
            fullWidth
            defaultValue={r?.vendor ?? ""}
          />
        </Box>

        <TextField
          name="notes"
          label="Notes"
          multiline
          minRows={3}
          fullWidth
          defaultValue={r?.notes ?? ""}
        />

        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          Next service reminder (optional)
        </Typography>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <TextField
            name="nextDueDate"
            label="Next due date"
            type="date"
            fullWidth
            defaultValue={r?.nextDueDate ?? ""}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <NumberField
            name="nextDueMileage"
            label="Next due mileage"
            defaultValue={r?.nextDueMileage}
          />
        </Box>

        <Stack direction="row" spacing={1.5}>
          <SubmitButton variant="contained" size="large" pendingLabel="Saving…">
            {submitLabel}
          </SubmitButton>
          <Button
            component={Link}
            href={cancelHref}
            variant="text"
            size="large"
            color="inherit"
          >
            Cancel
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
