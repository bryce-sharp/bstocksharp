"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Link from "@/components/shared/AppLink";

const LIST_KEY = "recipes.lastList";

/** The list remembers its search and filters, so All recipes returns to it as it was left. */
export function rememberList(search: string) {
  try {
    sessionStorage.setItem(LIST_KEY, `/recipes${search}`);
  } catch {
    // Storage can be blocked; All recipes then opens the plain list.
  }
}

function lastList(): string {
  try {
    return sessionStorage.getItem(LIST_KEY) ?? "/recipes";
  } catch {
    return "/recipes";
  }
}

/** The small back button above a page's title; for the list it returns to the last search. */
export default function BackLink({ href = "/recipes", label = "All recipes" }: { href?: string; label?: string }) {
  const router = useRouter();
  const toList = href === "/recipes";
  return (
    <Button
      component={Link}
      href={href}
      size="small"
      color="inherit"
      startIcon={<ArrowBackIcon />}
      onClick={(e: React.MouseEvent) => {
        if (!toList || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        router.push(lastList());
      }}
      sx={{ mb: 1.5, ml: -1 }}
    >
      {label}
    </Button>
  );
}
