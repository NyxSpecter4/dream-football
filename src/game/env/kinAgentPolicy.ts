// Dream Football — EXTERNAL AGENT adapter (swap test).
// One policy enters the match as an external LLM agent through the SAME
// Policy contract used by the baseline policies. Nothing in the engine or
// scorer changes: the agent's raw output is submitted to the engine boundary
// exactly as received (parsed only, NEVER repaired) — rejected actions are
// receipt data under documented rules R2/R3.
//
// Serving path: local ollama (kin-fabric tier 1) serving
// nyxspecter4/kin-cybersecurity-3b-gguf Q4_K_M — KIN v1 (Qwen2.5-3B base).
// KIN_AGENT_CONFIG is copied verbatim into the receipt (declared agent).

import type { Observation, Policy } from "../engine/types.ts";

export interface AgentCall {
  turn: number;
  latencyMs: number;
  promptChars: number;
  rawResponse: string;
  parsedAction: unknown;
  parseMethod: "direct_json" | "embedded_json" | "unparseable";
}

export interface KinAgentConfig {
  name: string;
  version: string;
  kind: "external-llm";
  model: string;
  quant: string;
  baseModel: string;
  access: string;
  endpoint: string;
  ollamaModel: string;
  temperature: number;
  numCtx: number;
  maxTokens: number;
  declared: boolean;
}

export const KIN_AGENT_CONFIG: KinAgentConfig = {
  // Environment overrides keep the harness identical for any external agent:
  // the SAME runner serves KIN-3B locally (ollama) without code changes.
  name: process.env.SWAP_AGENT_NAME ?? "kin-3b-external",
  version: "1.0.0",
  kind: "external-llm",
  model:
    process.env.SWAP_AGENT_MODEL_LABEL ??
    "nyxspecter4/kin-cybersecurity-3b (KIN v1 SFT — cybersecurity verification translator)",
  quant: process.env.SWAP_AGENT_QUANT ?? "Q4_K_M (kin-sft-lora-Q4_K_M.gguf)",
  baseModel: process.env.SWAP_AGENT_BASE ?? "Qwen/Qwen2.5-3B-Instruct",
  access: "local ollama serve (kin-fabric tier 1 tier-walk)",
  endpoint: process.env.SWAP_AGENT_ENDPOINT ?? "http://127.0.0.1:11434/api/chat",
  ollamaModel: process.env.SWAP_AGENT_OLLAMA_MODEL ?? "kin-3b-swap",
  temperature: 0,
  numCtx: 2048,
  maxTokens: 48,
  declared: true,
};

const SYSTEM_PROMPT = `You are an agent playing a deterministic turn-based football evaluation match. Each turn you receive one JSON observation and must choose exactly ONE action.

Rules of the match:
- Ball zones 0..10. Side A attacks toward zone 10; side B attacks toward zone 0.
- If your side has possession, you are the attacker: "advance" (ball +1 toward your goal), "pass" (ball +2), or "shoot" (legal only in range: side A needs ball >= 8, side B needs ball <= 2).
- If the other side has possession, you are the defender: "press" or "contain".
- An illegal or malformed action is a turnover/penalty. Always pick a legal action.

Respond with ONLY a JSON object, no prose, no markdown, exactly this shape:
{"side": "<your side>", "type": "<one of your legal actions>"}`;

/** Extract the agent's action from its raw output. Parse-only: never repair. */
export function extractAction(raw: string): {
  parsedAction: unknown;
  parseMethod: AgentCall["parseMethod"];
} {
  const trimmed = raw.trim();
  try {
    const v = JSON.parse(trimmed);
    if (typeof v === "object" && v !== null) return { parsedAction: v, parseMethod: "direct_json" };
  } catch {
    /* fall through to embedded extraction */
  }
  // last {...} block wins (models sometimes emit prose before the object)
  const matches = trimmed.match(/\{[^{}]*\}/g);
  if (matches && matches.length > 0) {
    try {
      const v = JSON.parse(matches[matches.length - 1]);
      if (typeof v === "object" && v !== null)
        return { parsedAction: v, parseMethod: "embedded_json" };
    } catch {
      /* unparseable */
    }
  }
  // submit the RAW string: the engine rejects it as malformed (honest evidence)
  return { parsedAction: raw, parseMethod: "unparseable" };
}

export interface KinAgentPolicy extends Policy {
  config: KinAgentConfig;
  calls: AgentCall[];
  act(obs: Observation): Promise<unknown>;
}

/** Build the external KIN-3B agent. Fails closed: no silent fallback policy. */
export function makeKinAgentPolicy(): KinAgentPolicy {
  const calls: AgentCall[] = [];
  return {
    name: KIN_AGENT_CONFIG.name,
    version: KIN_AGENT_CONFIG.version,
    config: KIN_AGENT_CONFIG,
    calls,
    async act(obs: Observation): Promise<unknown> {
      const user = `Observation: ${JSON.stringify(obs)}\nYour legal actions this turn: ${obs.legal.join(", ")}\nYour action:`;
      const t0 = Date.now();
      let raw = "";
      let lastErr: unknown = null;
      // one retry on transport error, then fail closed (no fallback policy)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(KIN_AGENT_CONFIG.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: KIN_AGENT_CONFIG.ollamaModel,
              stream: false,
              options: {
                temperature: KIN_AGENT_CONFIG.temperature,
                num_ctx: KIN_AGENT_CONFIG.numCtx,
                num_predict: KIN_AGENT_CONFIG.maxTokens,
              },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: user },
              ],
            }),
            signal: AbortSignal.timeout(120_000),
          });
          if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
          const data = (await res.json()) as { message?: { content?: string } };
          raw = data?.message?.content ?? "";
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (raw === "" && lastErr !== null) {
        throw new Error(`external agent unreachable: ${String(lastErr)}`);
      }
      const { parsedAction, parseMethod } = extractAction(raw);
      calls.push({
        turn: obs.turn + 1,
        latencyMs: Date.now() - t0,
        promptChars: SYSTEM_PROMPT.length + user.length,
        rawResponse: raw,
        parsedAction,
        parseMethod,
      });
      return parsedAction;
    },
  };
}
