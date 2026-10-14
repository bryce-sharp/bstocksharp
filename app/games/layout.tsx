import * as React from "react";
import Link from "@/components/shared/AppLink";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import AppShell from "@/components/shared/AppShell";
import SlidingHeader from "@/components/shared/SlidingHeader";
import GamesSkin from "@/components/games/GamesSkin";
import { getSession } from "@/lib/session";

// Games are public: signed-in visitors get the hub chrome, everyone else a bare header; both wear the game's colors.
export default async function GamesLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) {
    return (
      <GamesSkin>
        <AppShell current="games">{children}</AppShell>
      </GamesSkin>
    );
  }

  return (
    <GamesSkin>
      <SlidingHeader
        header={
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
        }
      >
        {children}
      </SlidingHeader>
    </GamesSkin>
  );
}
