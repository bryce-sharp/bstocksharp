import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupNameEditor from "./GroupNameEditor";
import GroupTabs, { type GroupTab } from "./GroupTabs";
import PeopleTab from "./PeopleTab";
import AccessTab from "./AccessTab";
import TimezoneSetting from "./TimezoneSetting";
import InvitesPanel, { type InviteRow } from "./InvitesPanel";
import DangerZone from "./DangerZone";
import ActivityLog from "./ActivityLog";
import { getSession } from "@/lib/session";
import { isEditor, isSiteAdmin } from "@/lib/auth";
import { allHubApps, currentLogin } from "@/lib/hub-apps";
import { getMyGroup, listGroupMembers } from "@/lib/queries/groups";
import { listPendingInvites } from "@/lib/queries/invites";
import { activityViewer, listActivity, listActivitySources } from "@/lib/queries/activity";

export const metadata = { title: "Hub settings" };

/** Whole days until a date, never below zero. */
function daysUntil(date: Date): number {
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 86_400_000));
}

// The household's control room (/people redirects here), one tab per job:
//   People    profiles and logins, and the claims that tie them together
//   Invites   the owner's invite links
//   Activity  the event log: the owner's household events, plus site events
//             for a site admin
//   Settings  the time zone and the exit doors (leave, transfer, delete)
// Your own password and passkeys are on /account.
export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; nudge?: string; next?: string }>;
}) {
  const { tab, nudge, next } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login"); // proxy already gates; belt anyway
  if ((await currentLogin())?.isHubLogin) redirect("/");
  // The old Sign-in tab, still linked from bookmarks and older sign-in redirects.
  if (tab === "sign-in" || nudge === "1") {
    const query = new URLSearchParams({
      ...(nudge ? { nudge } : {}),
      ...(next ? { next } : {}),
    }).toString();
    redirect(query ? `/account?${query}` : "/account");
  }

  const [group, canEdit, viewer, siteAdmin, apps] = await Promise.all([
    getMyGroup(),
    isEditor(),
    activityViewer(),
    isSiteAdmin(),
    allHubApps(),
  ]);
  // Membership controls (invites, removal, reset links) are the OWNER's.
  const viewerIsOwner =
    group?.ownerAccountId != null && group.ownerAccountId === session.accountId;
  const manages = viewerIsOwner && canEdit;

  const tabs: { value: GroupTab; label: string }[] = [
    { value: "people", label: "People" },
    { value: "access", label: "Access" },
    // People's sign-in links live on their People cards; this tab is the site admin's, for starting new hubs.
    ...(manages && siteAdmin ? [{ value: "invites" as const, label: "Invites" }] : []),
    ...(viewer ? [{ value: "activity" as const, label: "Activity" }] : []),
    { value: "settings", label: "Settings" },
  ];
  const active = tabs.find((t) => t.value === tab)?.value ?? "people";

  // Invite and reset links need an absolute URL: derive the origin from Host
  // headers (same idiom as lib/webauthn), never an env var.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:4545";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const inviteRows: InviteRow[] =
    active === "invites"
      ? (await listPendingInvites())
          // A person's sign-in link lives on their People card.
          .filter((inv) => inv.profileId === null)
          .map((inv) => ({
            id: inv.id,
            link: `${origin}/join/${inv.token}`,
            note: inv.note,
            household: inv.groupId !== null,
            reusable: inv.maxUses === null,
            expiresInDays: daysUntil(inv.expiresAt),
          }))
      : [];
  const [activity, activitySources] =
    active === "activity" && viewer
      ? await Promise.all([listActivity(viewer), listActivitySources(viewer)])
      : [null, []];
  const members = active === "settings" ? await listGroupMembers() : [];

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack spacing={2.5}>
        <GroupNameEditor name={group?.name ?? "Hub"} canEdit={canEdit} />

        <GroupTabs active={active} tabs={tabs} />

        {active === "people" ? (
          <PeopleTab
            accountId={session.accountId}
            ownerAccountId={group?.ownerAccountId ?? null}
            canEdit={canEdit}
            viewerIsOwner={viewerIsOwner}
            origin={origin}
          />
        ) : null}

        {active === "access" ? <AccessTab accountId={session.accountId} /> : null}

        {active === "invites" ? (
          <Stack spacing={2}>
            <InvitesPanel
              origin={origin}
              groupName={group?.name ?? "this hub"}
              invites={inviteRows}
              canMintHubs={siteAdmin}
            />
            <Typography variant="caption" color="text.secondary">
              Links are single-use and expire in 7 days unless you say
              otherwise. An invite makes them a member of this hub
              {siteAdmin
                ? "; an \u201cown hub\u201d invite (site admins only) gives them a fresh private one."
                : "."}
            </Typography>
          </Stack>
        ) : null}

        {active === "activity" && viewer && activity ? (
          <ActivityLog
            initial={activity}
            sources={activitySources}
            owner={viewer.scope.groupId !== null}
            siteAdmin={viewer.scope.site === true}
          />
        ) : null}

        {active === "settings" ? (
          <Stack spacing={2.5}>
            {/* The time zone only sets the finance day, so hubs without finance skip it. */}
            {apps.includes("finance") ? (
              <TimezoneSetting
                timezone={group?.timezone ?? "America/Chicago"}
                canEdit={canEdit}
              />
            ) : null}
            {!group?.isDemo ? (
              <DangerZone
                isOwner={viewerIsOwner}
                groupName={group?.name ?? "this hub"}
                others={members
                  .filter((m) => m.id !== session.accountId)
                  .map((m) => ({ id: m.id, username: m.username }))}
              />
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
