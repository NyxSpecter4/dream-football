import { createFileRoute } from "@tanstack/react-router";
import { GROK_BOTS } from "@/game/bots";

function canned(manager: string, human: string) {
  const bot = GROK_BOTS.find((b) => b.manager === manager);
  return `${human}? ${bot?.hello ?? "Noted."}`;
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
  const vibe = GROK_BOTS.find((b) => b.manager === manager)?.vibe ?? "sharp, short.";

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
            content: `You are ${manager}, a rival fantasy manager in Dream Football. Voice: ${vibe} One trash-talk line. No emojis. No hashtags. Under 18 words.`,
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
