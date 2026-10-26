import * as React from "react";
import AppShell from "@/components/shared/AppShell";

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  return <AppShell current="group">{children}</AppShell>;
}
