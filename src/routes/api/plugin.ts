import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/plugin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const host = url.searchParams.get("host") ?? "";
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q) return json({ ok: false, error: "missing q" }, 400);
        try {
          if (host === "sleeper") return json(await sleeper(q));
          if (host === "espn") return json(await espn(q));
          return json({ ok: false, error: "unknown host" }, 400);
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "fail" }, 502);
        }
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<unknown>;
}

async function sleeper(user: string) {
  const u = (await getJson(`https://api.sleeper.app/v1/user/${encodeURIComponent(user)}`)) as {
    user_id?: string;
    display_name?: string;
    username?: string;
  };
  if (!u?.user_id) return { ok: false, error: "no Sleeper user" };
  const year = new Date().getUTCFullYear();
  const leagues = (await getJson(
    `https://api.sleeper.app/v1/user/${u.user_id}/leagues/nfl/${year}`,
  )) as Array<{ league_id: string; name: string; total_rosters?: number }>;
  return {
    ok: true,
    host: "sleeper",
    name: u.display_name || u.username || user,
    leagues: (leagues ?? []).slice(0, 8).map((l) => ({
      id: l.league_id,
      name: l.name,
      size: l.total_rosters ?? 0,
    })),
  };
}

async function espn(leagueId: string) {
  const id = leagueId.replace(/\D/g, "");
  if (!id) return { ok: false, error: "need a public ESPN league ID" };
  const year = new Date().getUTCFullYear();
  const data = (await getJson(
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${id}?view=mSettings&view=mTeam`,
  )) as { settings?: { name?: string; size?: number }; teams?: unknown[] };
  const name = data.settings?.name;
  if (!name) return { ok: false, error: "private or missing. Public leagues only." };
  return {
    ok: true,
    host: "espn",
    name,
    size: data.settings?.size ?? (Array.isArray(data.teams) ? data.teams.length : 0),
  };
}
