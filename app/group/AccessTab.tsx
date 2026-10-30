import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import TabletMacIcon from "@mui/icons-material/TabletMac";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import PersonAvatar from "@/components/shared/PersonAvatar";
import { APPS } from "@/lib/apps";
import { allHubApps } from "@/lib/hub-apps";
import { hubBookAccess, readViewerBooks } from "@/lib/books";
import { allows } from "@/lib/sharing";
import { listGroupMembers } from "@/lib/queries/groups";
import { listProfiles } from "@/lib/queries/profiles";
import { requireGroupId } from "@/lib/session";
import { getHubName } from "@/lib/queries/group";

// Hub settings, Access: what each login can open, in one place. A book's name
// shows only when you are in it too; other books are counted, never named.
export default async function AccessTab({ accountId }: { accountId: number }) {
  const groupId = await requireGroupId();
  const [members, people, hubApps, books, mine, hubName] = await Promise.all([
    listGroupMembers(),
    listProfiles(),
    allHubApps(),
    hubBookAccess(groupId),
    readViewerBooks(),
    getHubName(),
  ]);
  const myBooks = new Set(mine.map((b) => b.id));
  const owned = new Set(members.flatMap((m) => (m.profileId === null ? [] : [m.profileId])));
  const noLogin = people.filter((p) => !owned.has(p.id));
  const personal = APPS.filter((a) => a.personal && hubApps.includes(a.slug));

  // People first, in the hub's order; then the shared login; then logins tied to no one.
  const order = (m: (typeof members)[number]) =>
    m.profileId !== null ? people.findIndex((p) => p.id === m.profileId) : m.isHubLogin ? 1000 : 2000;
  const logins = [...members].sort((a, b) => order(a) - order(b));

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        What each login can open. Apps are set on People; money books in Finance, Manage books; and each
        person picks who sees their own stuff on Your account.
      </Typography>
      {logins.map((m) => {
        const person = people.find((p) => p.id === m.profileId) ?? null;
        const looker = { profileId: m.profileId, isHubLogin: m.isHubLogin };
        const apps = APPS.filter((a) => hubApps.includes(a.slug) && (m.apps ?? hubApps).includes(a.slug));
        const opensFinance = apps.some((a) => a.slug === "finance");
        const itsBooks = books.filter((b) =>
          m.isHubLogin ? b.hubLogin : m.profileId !== null && b.members.includes(m.profileId),
        );
        const named = itsBooks.filter((b) => myBooks.has(b.id));
        const unnamed = itsBooks.length - named.length;
        const hidden = people.flatMap((p) =>
          personal.filter((a) => !allows(p, a.slug, looker, owned.has(p.id))).map((a) => `${p.name}'s ${a.name.toLowerCase()}`),
        );
        const title = person?.name ?? (m.isHubLogin ? (hubName ?? "Hub") : m.username);

        return (
          <Paper key={m.id} variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
              {person ? (
                <PersonAvatar person={person} size={32} />
              ) : m.isHubLogin ? (
                <TabletMacIcon color="action" />
              ) : (
                <PersonOutlineIcon color="action" />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {title}
                  {m.id === accountId ? (
                    <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
                      {" "}
                      (you)
                    </Typography>
                  ) : null}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {m.isHubLogin ? `Shared login, signs in as ${m.username}` : `Signs in as ${m.username}`}
                  {!person && !m.isHubLogin ? ", tied to no one" : ""}
                </Typography>
              </Box>
            </Box>

            <Stack spacing={1}>
              <Row label="Apps">
                {apps.length ? apps.map((a) => <Chip key={a.slug} size="small" label={a.name} />) : <None />}
              </Row>
              <Row label="Money books">
                {!opensFinance ? (
                  <None text="Finance is off for this login" />
                ) : itsBooks.length === 0 ? (
                  <None />
                ) : (
                  <>
                    {named.map((b) => (
                      <Chip key={b.id} size="small" label={b.name} variant="outlined" />
                    ))}
                    {unnamed ? (
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        {named.length ? "+ " : ""}
                        {unnamed} book{unnamed === 1 ? "" : "s"} you are not in
                      </Typography>
                    ) : null}
                  </>
                )}
              </Row>
              {personal.length ? (
                <Row label="Kept from it">
                  {hidden.length ? (
                    <Typography variant="body2">{hidden.join(", ")}</Typography>
                  ) : (
                    <None text="Nothing; it sees everyone's" />
                  )}
                </Row>
              ) : null}
            </Stack>
          </Paper>
        );
      })}
      {noLogin.length ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            People without a login
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.5 }}>
            Nobody signs in as them, so they open nothing themselves. Everyone in the hub can see and change
            their stuff, and they have no sharing settings until they get a login.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {noLogin.map((p) => (
              <Chip key={p.id} avatar={<PersonAvatar person={p} size={24} />} label={p.name} variant="outlined" />
            ))}
          </Box>
        </Paper>
      ) : null}
    </Stack>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "baseline" }}>
      <Typography variant="caption" sx={{ color: "text.secondary", width: 96, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center", minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

function None({ text = "None" }: { text?: string }) {
  return (
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      {text}
    </Typography>
  );
}
