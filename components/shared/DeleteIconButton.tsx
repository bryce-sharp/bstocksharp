"use client";

import { useFormStatus } from "react-dom";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";

function Inner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <IconButton
      type="submit"
      size="small"
      color="error"
      aria-label={label}
      disabled={pending}
    >
      {pending ? (
        <CircularProgress size={16} color="inherit" />
      ) : (
        <DeleteOutlineIcon fontSize="small" />
      )}
    </IconButton>
  );
}

// Reusable compact delete: a confirm dialog, then a Server Action, with a
// spinner while it runs. Used for maintenance records (and future fuel/parts).
export default function DeleteIconButton({
  action,
  confirmMessage,
  label = "Delete",
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      style={{ display: "inline-flex" }}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <Inner label={label} />
    </form>
  );
}
