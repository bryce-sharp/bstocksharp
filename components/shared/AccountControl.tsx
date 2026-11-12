import { listGroupMembers } from "@/lib/queries/groups";
import { getMe } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { allHubApps, currentLogin } from "@/lib/hub-apps";
import { getHubName } from "@/lib/queries/group";
import AccountMenu from "./AccountMenu";
import type { Viewing } from "./ViewingControl";

// The top-right menu: always the signed-in login (you, or the hub's shared login). `viewing` is passed only while an
// app with per-person data is showing your own stuff, so the menu offers "Switch person".
export default async function AccountControl({ viewing = null }: { viewing?: Viewing | null }) {
  const [me, members, session, apps, login, hubName] = await Promise.all([
    getMe(),
    listGroupMembers(),
    getSession(),
    allHubApps(),
    currentLogin(),
    getHubName(),
  ]);
  const hubLogin = login?.isHubLogin ?? false;
  const gamesOnly = apps.length === 1 && apps[0] === "games";
  const username = members.find((m) => m.id === session?.accountId)?.username ?? null;

  return (
    <AccountMenu
      me={me ? { name: me.name, color: me.color } : null}
      hubLogin={hubLogin}
      hubName={hubName ?? "Hub"}
      username={username}
      hubSettings={!hubLogin && !(gamesOnly && members.length <= 1)}
      accountSettings={!hubLogin}
      viewing={viewing}
    />
  );
}
