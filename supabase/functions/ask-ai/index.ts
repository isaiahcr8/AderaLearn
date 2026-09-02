const PROVIDER = (Deno.env.get("AI_PROVIDER") ?? "gemini").toLowerCase().trim();
const API_KEY = Deno.env.get("AI_API_KEY") ?? "";
const MODEL = (Deno.env.get("AI_MODEL") ?? "").trim();
const BASE_URL = (Deno.env.get("AI_BASE_URL") ?? "").trim();
const REQUIRE_AUTH =
  (Deno.env.get("REQUIRE_AUTH") ?? "false").toLowerCase().trim() === "true";
const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") ?? "*";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const DEFAULT_MODEL: Record<string, string> = {
  gemini: "gemini-3.6-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

const MAX_TOKENS = 800;
const TEMPERATURE = 0.7;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function aiFetch(
  url: string,
  init: RequestInit,
  tries = 3,
): Promise<Response> {
  let last: Response | null = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    const resp = await fetch(url, init);

    if (![429, 500, 502, 503, 529].includes(resp.status)) {
      return resp;
    }

    last = resp;
    if (attempt < tries - 1) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  return last as Response;
}

type InMsg = { role?: string; text?: string };
type Norm = { role: "user" | "assistant"; text: string };

function normalize(raw: unknown): Norm[] {
  const list = Array.isArray(raw) ? (raw as InMsg[]) : [];
  const out: Norm[] = [];

  for (const m of list) {
    const text = typeof m?.text === "string" ? m.text.trim() : "";
    if (!text) continue;

    const isAssistant =
      m?.role === "ai" || m?.role === "assistant" || m?.role === "model";

    out.push({ role: isAssistant ? "assistant" : "user", text });
  }

  while (out.length && out[0].role === "assistant") {
    out.shift();
  }

  return out;
}

function buildSystemPrompt(topic: string, subject: string): string {
  return (
    "You are AderaLearn AI, a friendly and encouraging tutor for students. " +
    "Explain clearly and simply, keep paragraphs short, and give small concrete " +
    "examples. If a question is not about learning, gently steer back. " +
    (topic ? `The student is currently studying "${topic}"` : "") +
    (subject ? ` in ${subject}.` : topic ? "." : "")
  );
}

async function callGemini(system: string, msgs: Norm[]): Promise<string> {
  const model = MODEL || DEFAULT_MODEL.gemini;
  const base = (BASE_URL || "https://generativelanguage.googleapis.com").replace(
    /\/+$/,
    "",
  );

  const resp = await aiFetch(
    `${base}/v1beta/models/${model}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        })),
        generationConfig: {
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_TOKENS,
        },
      }),
    },
  );

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message ?? `Gemini error ${resp.status}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p?.text ?? "").join("").trim();
}

async function callOpenAI(system: string, msgs: Norm[]): Promise<string> {
  const model = MODEL || DEFAULT_MODEL.openai;
  const base = (BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

  const resp = await aiFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        ...msgs.map((m) => ({ role: m.role, content: m.text })),
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message ?? `OpenAI error ${resp.status}`);
  }

  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}

async function callAnthropic(system: string, msgs: Norm[]): Promise<string> {
  const model = MODEL || DEFAULT_MODEL.anthropic;
  const base = (BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");

  const resp = await aiFetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      messages: msgs.map((m) => ({ role: m.role, content: m.text })),
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message ?? `Anthropic error ${resp.status}`);
  }

  const blocks = data?.content ?? [];
  return blocks.map((b: { text?: string }) => b?.text ?? "").join("").trim();
}

async function isSignedInUser(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !SUPABASE_URL) return false;

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) return false;
    const user = await r.json();
    return Boolean(user?.id);
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!API_KEY) {
    return json({ error: "AI_API_KEY is not set on the server" }, 500);
  }

  if (REQUIRE_AUTH && !(await isSignedInUser(req.headers.get("Authorization")))) {
    return json({ error: "Sign in required" }, 401);
  }

  let payload: { messages?: unknown; topic?: unknown; subject?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const topic = String(payload?.topic ?? "").trim();
  const subject = String(payload?.subject ?? "").trim();
  const msgs = normalize(payload?.messages);

  if (!msgs.length) {
    return json({ text: "Ask me a question to get started." });
  }

  const system = buildSystemPrompt(topic, subject);

  try {
    let text = "";

    if (PROVIDER === "openai") {
      text = await callOpenAI(system, msgs);
    } else if (PROVIDER === "anthropic") {
      text = await callAnthropic(system, msgs);
    } else if (PROVIDER === "gemini") {
      text = await callGemini(system, msgs);
    } else {
      return json({ error: `Unknown AI_PROVIDER: ${PROVIDER}` }, 500);
    }

    return json({
      text: text || "Sorry, I couldn't generate a response this time.",
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : String(err) },
      502,
    );
  }
});
