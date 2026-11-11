"use client";

import * as React from "react";
import { NumericFormat } from "react-number-format";
import TextField from "@mui/material/TextField";

// Text input that formats with thousands separators (and an optional prefix like
// "$") as you type, while submitting the clean raw number to the server.
export default function NumberField({
  name,
  label,
  defaultValue,
  prefix,
  decimalScale = 0,
  allowNegative = false,
  onValueChange,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  prefix?: string;
  decimalScale?: number;
  allowNegative?: boolean;
  /** Called with the raw value on every change, for forms that total as you type. */
  onValueChange?: (raw: string) => void;
}) {
  const [raw, setRaw] = React.useState<string>(
    defaultValue != null && defaultValue !== "" ? String(defaultValue) : "",
  );

  return (
    <>
      <NumericFormat
        customInput={TextField}
        label={label}
        value={raw}
        thousandSeparator=","
        prefix={prefix}
        decimalScale={decimalScale}
        allowNegative={allowNegative}
        fullWidth
        onValueChange={(values) => {
          setRaw(values.value);
          onValueChange?.(values.value);
        }}
      />
      {/* Raw, unformatted value (no commas/prefix) for the form + DB. */}
      <input type="hidden" name={name} value={raw} readOnly />
    </>
  );
}
