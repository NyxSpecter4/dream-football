import { useEffect, useRef } from "react";
import { useP2PRoom } from "@/lib/multiplayer";
import { useGame } from "@/game/store";
import { asJersey, asNetMsg, p2pRoomId, pickSave } from "@/game/net";

export function OnlineBridge() {
  const roomCode = useGame((s) => s.roomCode);
  const identity = useGame((s) => s.onlineIdentity);
  const isHost = useGame((s) => s.isHost);
  const p2p = useP2PRoom({
    room: p2pRoomId(roomCode),
    name: identity?.name || "GM",
  });

  useEffect(() => {
    const g = useGame.getState();
    g.setLocalPeerId(p2p.selfId);
    if (g.onlineIdentity) g.upsertLobbySeat(p2p.selfId, g.onlineIdentity);
  }, [p2p.selfId]);

  useEffect(() => {
    useGame.getState().setMesh({
      joined: p2p.joined,
      peers: p2p.peers.map((p) => ({
        id: p.id,
        name: p.name,
        connectionState: p.connectionState,
        rttMs: p.rttMs,
      })),
    });
  }, [p2p.joined, p2p.peers]);

  useEffect(() => {
    if (isHost) {
      useGame.getState().setSendAction(null);
      return;
    }
    useGame.getState().setSendAction((act) => {
      p2p.send({ t: "act", act });
    });
    return () => useGame.getState().setSendAction(null);
  }, [isHost, p2p.send]);

  useEffect(() => {
    return p2p.onMessage((from, data) => {
      const msg = asNetMsg(data);
      if (!msg) return;
      const g = useGame.getState();
      if (msg.t === "hello") {
        g.upsertLobbySeat(from, {
          name: String(msg.name || "Club").slice(0, 22),
          short: String(msg.short || "CLB").slice(0, 4).toUpperCase(),
          jersey: asJersey(msg.jersey),
        });
        if (msg.host) g.noteHost(from);
      } else if (msg.t === "act" && g.isHost) {
        g.applyRemote(from, msg.act);
      } else if (msg.t === "sync" && !g.isHost) {
        g.applySync(msg.save, msg.lastSold);
      }
    });
  }, [p2p.onMessage]);

  const greeted = useRef(new Set<string>());
  useEffect(() => {
    if (!p2p.joined || !identity) return;
    const hello = { t: "hello" as const, ...identity, host: isHost };
    p2p.send(hello);
    for (const p of p2p.peers) {
      if (p.connectionState !== "connected") continue;
      if (greeted.current.has(p.id)) continue;
      greeted.current.add(p.id);
      p2p.send(hello, p.id);
      const g = useGame.getState();
      if (g.isHost && g.teams.length > 0) {
        p2p.send({ t: "sync", save: pickSave(g), lastSold: g.lastSold }, p.id);
      }
    }
  }, [p2p.joined, p2p.peers, p2p.send, identity, isHost]);

  useEffect(() => {
    if (!isHost) return;
    let prev = "";
    return useGame.subscribe((s) => {
      if (!s.isHost || s.teams.length === 0 || s.screen === "lobby") return;
      const payload = { t: "sync" as const, save: pickSave(s), lastSold: s.lastSold };
      const key = JSON.stringify(payload);
      if (key === prev) return;
      prev = key;
      p2p.send(payload);
    });
  }, [isHost, p2p.send]);

  return null;
}
