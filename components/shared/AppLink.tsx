"use client";

import * as React from "react";
import NextLink from "next/link";
import type { LinkProps } from "next/link";
import { usePathname } from "next/navigation";
import { gameAtPath } from "@/lib/games";

// A thin "use client" wrapper around next/link.
//
// WHY THIS EXISTS: `next/link` is a shared module (it can render inside Server
// Components), so its export is a plain function — NOT a serializable client
// reference. Rendering `<Link>` in a Server Component is fine, but passing the
// component itself as a prop (e.g. MUI's `component={Link}` / `LinkComponent`)
// makes React try to serialize a raw function across the server→client boundary.
// As of Next 16 that is a hard error:
//   "Functions cannot be passed directly to Client Components…"
//
// Because THIS module is "use client", importing AppLink into a Server Component
// yields a client reference, which IS allowed to cross the boundary as a prop.
// So `component={AppLink}` works everywhere `component={Link}` used to.
const AppLink = React.forwardRef<
  HTMLAnchorElement,
  LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>
>(function AppLink(props, ref) {
  const pathname = usePathname();
  const target = String(props.href);
  // A game is its own home-screen app, so crossing into or out of one loads the page fresh for the phone to read its app setting.
  const crossesApp = target.startsWith("/") && gameAtPath(pathname)?.slug !== gameAtPath(target.split(/[?#]/)[0]!)?.slug;
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    props.onClick?.(e);
    if (!crossesApp || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.location.assign(target);
  };
  return <NextLink ref={ref} {...props} onClick={onClick} />;
});

export default AppLink;
