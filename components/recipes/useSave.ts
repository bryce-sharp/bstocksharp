"use client";

import * as React from "react";

/** Runs a dialog's server action: busy while it runs, its error shown, and the dialog closed when it succeeds. */
export function useSave(onClose: () => void) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, start] = React.useTransition();
  const run = (work: () => Promise<{ error: string } | undefined>) =>
    start(async () => {
      setError(null);
      const result = await work();
      if (result?.error) setError(result.error);
      else onClose();
    });
  return { error, busy, run };
}
