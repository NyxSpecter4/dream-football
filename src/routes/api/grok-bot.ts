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
  const manager = (body.manager || "Lane Harlan").slice(0, 24);
  const human = (body.human || "You").slice(0, 22);
  const text = (body.text || "").slice(0, 140);
  const bot = GROK_BOTS.find((b) => b.manager === manager);
  const vibe = bot?.vibe ?? "sharp, short.";
  const desk = bot?.desk ?? "the desk";

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: true, manager, reply: canned(manager, human) });
  }

  const cheap = ["grok-4-1-fast", "grok-3-mini"];
  try {
    for (const model of cheap) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 40,
          temperature: 0.8,
          messages: [
            {
              role: "system",
              content: `You are ${manager} (${desk}) on a Sunday NFL pregame desk in Dream Football. Voice: ${vibe} You bid like a professional fantasy manager. One trash-talk line. No emojis. Under 16 words.`,
            },
            { role: "user", content: `${human} said: ${text}` },
          ],
        }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const reply = (json.choices?.[0]?.message?.content ?? "").trim();
      if (reply) return Response.json({ ok: true, manager, reply: reply.slice(0, 180), model });
    }
  } catch {
    /* canned */
  }
  return Response.json({ ok: true, manager, reply: canned(manager, human) });
};

export const Route = createFileRoute("/api/grok-bot")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
