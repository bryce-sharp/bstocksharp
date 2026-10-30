"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SubmitButton from "@/components/shared/SubmitButton";

export default function DeleteVehicleButton({
  action,
  name,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete "${name}"? This also removes its maintenance, fuel, parts, and build records.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton
        color="error"
        variant="outlined"
        startIcon={<DeleteOutlineIcon />}
        pendingLabel="Deleting…"
      >
        Delete
      </SubmitButton>
    </form>
  );
}
