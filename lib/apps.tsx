import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import GarageIcon from "@mui/icons-material/Garage";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import MonitorWeightIcon from "@mui/icons-material/MonitorWeight";
import SavingsIcon from "@mui/icons-material/Savings";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";

// The registry of sub-apps in the hub. Add an app here (plus its route folder)
// and it shows up in the Hub launcher and the header app-switcher automatically.
export type AppNavLink = { label: string; href: string };

export type AppDef = {
  slug: string;
  name: string;
  tagline: string;
  href: string;
  Icon: ComponentType<SvgIconProps>;
  accent: string;
  /** In-app header links. Single source of truth — the header + AppSwitcher
   *  read these, so a layout never re-declares its own nav. */
  nav?: AppNavLink[];
};

export const APPS: AppDef[] = [
  {
    slug: "garage",
    name: "Garage",
    tagline: "Cars, maintenance & the Miata build",
    href: "/garage",
    Icon: GarageIcon,
    accent: "#4caf7d",
    nav: [{ label: "Bible", href: "/garage/bible" }],
  },
  {
    slug: "workout",
    name: "Workout",
    tagline: "Tonight's exercises, with timers",
    href: "/workout",
    Icon: FitnessCenterIcon,
    accent: "#e0864f",
    nav: [
      { label: "Today", href: "/workout/today" },
      { label: "Week", href: "/workout" },
      { label: "Catalog", href: "/workout/catalog" },
    ],
  },
  {
    slug: "weight",
    name: "Weight",
    tagline: "Weekly weigh-ins, trend & goal pace",
    href: "/weight",
    Icon: MonitorWeightIcon,
    accent: "#4f86e0",
    nav: [
      { label: "Dashboard", href: "/weight" },
      { label: "History", href: "/weight/history" },
    ],
  },
  {
    slug: "finance",
    name: "Finance",
    tagline: "Net worth, income & the budget",
    href: "/finance",
    Icon: SavingsIcon,
    accent: "#3fa796",
    nav: [
      { label: "Budget", href: "/finance" },
      { label: "History", href: "/finance/transactions" },
      { label: "Categories", href: "/finance/categories" },
      { label: "ATLAS", href: "/finance/atlas" },
      { label: "Net Worth", href: "/finance/net-worth" },
    ],
  },
  {
    slug: "games",
    name: "Games",
    tagline: "Little games, public to play",
    href: "/games",
    Icon: SportsEsportsIcon,
    accent: "#c4703f",
    nav: [
      { label: "Gallery", href: "/games" },
      { label: "Snug", href: "/games/snug" },
    ],
  },
];

export function getApp(slug: string): AppDef | undefined {
  return APPS.find((a) => a.slug === slug);
}

/**
 * The apps a profile should see, given the slugs they've hidden and the apps
 * the hub has (`offered`, lib/hub-apps). Hiding is a personal preference, not
 * a permission. If a profile somehow hid every app, we fall back to all of
 * the hub's apps so the hub is never a dead end.
 */
export function visibleApps(hidden: string[] = [], offered?: string[]): AppDef[] {
  const hubs = offered ? APPS.filter((a) => offered.includes(a.slug)) : APPS;
  const shown = hubs.filter((a) => !hidden.includes(a.slug));
  return shown.length > 0 ? shown : hubs;
}
