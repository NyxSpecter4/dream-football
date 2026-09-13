import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { TitleScreen } from "@/components/game/TitleScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { AuctionScreen } from "@/components/game/AuctionScreen";
import { LeagueApp } from "@/components/game/LeagueApp";
import { OnlineBridge } from "@/components/game/OnlineBridge";
import { useGame } from "@/game/store";
import { parseRoomCode } from "@/game/net";
import { PluginBar } from "@/components/game/PluginBar";

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: (raw: Record<string, unknown>) => ({
    room: typeof raw.room === "string" ? raw.room : undefined,
  }),
});

function Home() {
  const screen = useGame((s) => s.screen);
  const online = useGame((s) => s.online);
  const roomCode = useGame((s) => s.roomCode);
  const identity = useGame((s) => s.onlineIdentity);
  const teams = useGame((s) => s.teams);
  const search = Route.useSearch();

  useEffect(() => {
    const result = useGame.persist.rehydrate();
    void Promise.resolve(result).then(() => {
      useGame.getState().setHydrated();
    });
  }, []);

  useEffect(() => {
    const code = parseRoomCode(search.room ?? "");
    if (!code) return;
    const s = useGame.getState();
    if (s.online && s.roomCode === code) return;
    if (s.screen === "title" || s.screen === "setup") s.setScreen("lobby");
  }, [search.room]);

  const league =
    screen === "home" ||
    screen === "roster" ||
    screen === "matchup" ||
    screen === "standings" ||
    screen === "offseason";

  return (
    <>
      <PluginBar />
      {online && roomCode && identity ? <OnlineBridge key={roomCode} /> : null}
      {screen === "title" || (league && teams.length === 0) ? <TitleScreen /> : null}
      {screen === "setup" ? <SetupScreen /> : null}
      {screen === "lobby" ? <LobbyScreen /> : null}
      {screen === "draft" && teams.length > 0 ? <AuctionScreen /> : null}
      {league && teams.length > 0 ? <LeagueApp /> : null}
    </>
  );
}
