import { createFileRoute } from "@tanstack/react-router";

const CANNED: Record<string, string[]> = {
  "Grok Zero": ["Stars cost stars. I'm not scared of the cap.", "If he's a WR1 I'm in."],
  "Grok Fade": ["That's a year late. I'll wait.", "Value or I pass."],
  "Grok Smash": ["Give me the back. I'll pay.", "RBs don't grow on waivers."],
  "Grok Cold": ["Weather's a factor. I'm fading that card.", "Sit him. I'm not cute."],
  "Grok Prime": ["That's the pick. Don't overthink it.", "I like the spot."],
  "Grok Pack": ["Titletown doesn't panic.", "We'll see him in January."],
  "Grok Wire": ["Trending for a reason. I filed."],
};

function canned(manager: string, human: string) {
  const pool = CANNED[manager] ?? ["Noted."];
  const line = pool[Math.floor(Math.random() * pool.length)]!;
  return `${human}? ${line}`;
}

const handle = async ({ request }: { request: Request }) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), { status: 405 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    manager?: string;
    human?: string;
    text?: string;
  };
  const manager = (body.manager || "Grok Zero").slice(0, 24);
  const human = (body.human || "You").slice(0, 22);
  const text = (body.text || "").slice(0, 140);

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: true, manager, reply: canned(manager, human) });
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 70,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content: `You are ${manager}, a rival fantasy football manager in Dream Football. One short trash-talk line. No emojis. No hashtags. Under 18 words.`,
          },
          { role: "user", content: `${human} said: ${text}` },
        ],
      }),
    });
    if (!res.ok) {
      return Response.json({ ok: true, manager, reply: canned(manager, human) });
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const reply = (json.choices?.[0]?.message?.content ?? "").trim() || canned(manager, human);
    return Response.json({ ok: true, manager, reply: reply.slice(0, 180) });
  } catch {
    return Response.json({ ok: true, manager, reply: canned(manager, human) });
  }
};

export const Route = createFileRoute("/api/grok-bot")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
