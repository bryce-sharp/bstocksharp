import * as React from "react";
import { redirect } from "next/navigation";
import AppHeader from "@/components/shared/AppHeader";
import ProfileControl from "@/components/shared/ProfileControl";
import SlidingHeader from "@/components/shared/SlidingHeader";
import { getActiveProfile } from "@/lib/profile";
import { getApp } from "@/lib/apps";
import { hubApps } from "@/lib/hub-apps";

// The shared chrome for every sub-app: the header (identity + nav + account
// menu) above the app's pages. A layout only says which app it is — the nav,
// hidden-app set, and account menu are all resolved here, so the header is
// wired in exactly one place. Per-app theming, when it lands, wraps this in a
// nested ThemeProvider inside each app's layout.
export default async function AppShell({
  current,
  children,
}: {
  current: string;
  children: React.ReactNode;
}) {
  const [active, apps] = await Promise.all([getActiveProfile(), hubApps()]);
  const app = getApp(current);
  // An app this hub does not have (a games-only sign-up opening /finance) goes home instead.
  if (app && apps.length && !apps.includes(app.slug)) redirect("/");

  return (
    <SlidingHeader
      header={
        <AppHeader
          current={current}
          nav={app?.nav ?? []}
          hiddenApps={active?.hiddenApps ?? []}
          hubApps={apps}
          profileControl={<ProfileControl />}
        />
      }
    >
      {children}
    </SlidingHeader>
  );
}
