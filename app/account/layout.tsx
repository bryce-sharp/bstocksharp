import * as React from "react";
import AppShell from "@/components/shared/AppShell";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AppShell current="account">{children}</AppShell>;
}
