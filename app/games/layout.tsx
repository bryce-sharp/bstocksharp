import * as React from "react";
import Link from "@/components/shared/AppLink";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import AppShell from "@/components/shared/AppShell";
import GamesChrome from "@/components/games/GamesChrome";
import { getSession } from "@/lib/session";

// Games are public: signed-in visitors get the hub chrome, everyone else a bare header.
export default async function GamesLayout({ children }: { children: React.ReactNode }) {
  const header = (await getSession()) ? (
    <AppShell current="games">{null}</AppShell>
  ) : (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: "background.paper", color: "text.primary", borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Toolbar>
        <Button component={Link} href="/games" color="inherit" startIcon={<SportsEsportsIcon />}>
          Games
        </Button>
      </Toolbar>
    </AppBar>
  );

  return <GamesChrome header={header}>{children}</GamesChrome>;
}
