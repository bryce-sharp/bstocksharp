import * as React from "react";
import { redirect } from "next/navigation";
import AppHeader from "@/components/shared/AppHeader";
import AccountControl from "@/components/shared/AccountControl";
import ViewingControl, { VIEWING_APPS } from "@/components/shared/ViewingControl";
import SlidingHeader from "@/components/shared/SlidingHeader";
import { getMe } from "@/lib/profile";
import { getApp } from "@/lib/apps";
import { hubApps } from "@/lib/hub-apps";
import { bookMenu } from "@/lib/books";

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
  const [me, apps] = await Promise.all([getMe(), hubApps()]);
  const app = getApp(current);
  // An app this hub does not have (a games-only sign-up opening /finance) goes home instead.
  if (app && apps.length && !apps.includes(app.slug)) redirect("/");
  // Money books sit under Finance in the app menu, so any app can jump straight into one.
  const books = apps.includes("finance") ? await bookMenu() : null;

  return (
    <SlidingHeader
      header={
        <AppHeader
          current={current}
          nav={app?.nav ?? []}
          hiddenApps={me?.hiddenApps ?? []}
          hubApps={apps}
          books={books}
          appControl={VIEWING_APPS.includes(current) ? <ViewingControl app={current} /> : null}
          profileControl={<AccountControl />}
        />
      }
    >
      {children}
    </SlidingHeader>
  );
}
