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

// Per request-type output allowance. Each type is produced in a SINGLE request —
// no automatic continuation / retry calls — so the limit is set high enough for
// a complete answer on its own. Tutor replies that still hit the ceiling come
// back with `truncated: true` and the student can ask a follow-up.
const MAX_TOKENS: Record<RequestType, number> = {
  tutor: 2048,
  lesson: 3072,
  quiz: 2600,
};

const TEMPERATURE: Record<RequestType, number> = {
  tutor: 0.7,
  lesson: 0.6,
  quiz: 0.4,
};

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const QUIZ_MIN = 3;
const QUIZ_MAX = 10;
const QUIZ_DEFAULT = 5;

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

// 429 is deliberately NOT retried here: on the free tier a quota hit will not
// clear in a few hundred ms, and retrying just spends more of the quota. Only
// transient server errors are retried.
async function aiFetch(
  url: string,
  init: RequestInit,
  tries = 3,
): Promise<Response> {
  let last: Response | null = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    const resp = await fetch(url, init);

    if (![500, 502, 503, 529].includes(resp.status)) {
      return resp;
    }

    last = resp;
    if (attempt < tries - 1) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }

  return last as Response;
}

// Thrown by the provider callers so the top-level handler can turn it into a
// clean, student-safe JSON error while the real detail goes only to the logs.
class AiError extends Error {
  httpStatus: number;
  code: string;
  retryAfter?: number;
  detail: string;

  constructor(opts: {
    httpStatus: number;
    code: string;
    publicMessage: string;
    detail: string;
    retryAfter?: number;
  }) {
    super(opts.publicMessage);
    this.name = "AiError";
    this.httpStatus = opts.httpStatus;
    this.code = opts.code;
    this.detail = opts.detail;
    this.retryAfter = opts.retryAfter;
  }
}

// Best-effort "retry after N seconds" from a 429 response: the Retry-After
// header, or Gemini's error.details[].retryDelay ("37s").
function parseRetryAfter(resp: Response, body: unknown): number | undefined {
  const header = resp.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs) && secs > 0) return Math.ceil(secs);
  }

  const details = (body as { error?: { details?: unknown[] } })?.error?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      const rd = (d as { retryDelay?: unknown })?.retryDelay;
      if (typeof rd === "string") {
        const m = rd.match(/([\d.]+)\s*s/i);
        if (m) return Math.ceil(Number(m[1]));
      }
    }
  }

  return undefined;
}

// Convert any non-OK provider response into an AiError. Logs the full body for
// Supabase function logs; never lets provider/model/billing text reach the client.
function providerFailure(resp: Response, body: unknown, label: string): never {
  const detail =
    (body as { error?: { message?: string } })?.error?.message ??
    `${label} HTTP ${resp.status}`;

  console.error(
    `[ask-ai] ${label} ${resp.status}: ${JSON.stringify(body).slice(0, 1000)}`,
  );

  if (resp.status === 429) {
    throw new AiError({
      httpStatus: 429,
      code: "RATE_LIMITED",
      publicMessage:
        "The AI Tutor is busy right now. Please wait about one minute and try again.",
      retryAfter: parseRetryAfter(resp, body),
      detail,
    });
  }

  throw new AiError({
    httpStatus: 502,
    code: "PROVIDER_ERROR",
    publicMessage: "The AI service had a problem. Please try again in a moment.",
    detail,
  });
}

type RequestType = "tutor" | "lesson" | "quiz";
type InMsg = { role?: string; text?: string };
type Norm = { role: "user" | "assistant"; text: string };
type GenOpts = { maxTokens: number; temperature: number; json: boolean };
type GenResult = { text: string; truncated: boolean };

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

/* ----------------------------- system prompts ----------------------------- */

function buildTutorPrompt(topic: string, subject: string): string {
  return (
    "You are AderaLearn AI, a friendly and encouraging tutor for students. " +
    "Explain clearly and simply, keep paragraphs short, and give small concrete " +
    "examples. Finish every explanation completely. If a question is not about " +
    "learning, gently steer back. " +
    (topic ? `The student is currently studying "${topic}"` : "") +
    (subject ? ` in ${subject}.` : topic ? "." : "")
  );
}

const LESSON_PROMPT =
  "You are AderaLearn AI, an expert teacher writing a self-contained lesson for " +
  "a secondary-school student. You are given a SUBJECT and a TOPIC. Respond with " +
  "ONLY a JSON object (no markdown, no code fences) using EXACTLY these keys:\n" +
  '- "relevant": boolean — true if the topic is genuinely studied within the ' +
  "given subject (be generous: sub-topics, named laws, quantities and closely " +
  "related ideas all count). Set it false ONLY when the topic clearly belongs " +
  "to a different school subject.\n" +
  '- "suggestion": string — ONLY when "relevant" is false: one friendly ' +
  "sentence naming the subject the topic really belongs to and suggesting two " +
  "or three valid topics for the chosen subject instead. Use \"\" when relevant.\n" +
  '- "title": string — the lesson title.\n' +
  '- "introduction": string — 2-3 sentences on what the topic is and why it matters.\n' +
  '- "explanation": array of strings — each item is one short paragraph that ' +
  "builds understanding step by step (aim for 4-7 items).\n" +
  '- "examples": array of strings — 2-4 concrete worked examples or real-world ' +
  "illustrations.\n" +
  '- "keyPoints": array of strings — 4-6 concise takeaways.\n' +
  '- "summary": string — a short recap paragraph.\n' +
  'When "relevant" is false you may leave the lesson fields as empty strings / ' +
  "empty arrays. Keep the language simple, accurate and encouraging.";

function quizPrompt(count: number): string {
  return (
    "You are AderaLearn AI, generating a multiple-choice quiz that tests real " +
    "understanding. Respond with ONLY a JSON object (no markdown, no code " +
    'fences) shaped exactly like:\n' +
    '{"questions":[{"question":string,"options":[string,string,string,string],' +
    '"correctIndex":number,"explanation":string}]}\n' +
    "Rules:\n" +
    `- Exactly ${count} questions.\n` +
    "- Exactly 4 options per question, all plausible.\n" +
    '- "correctIndex" is the 0-based index of the single correct option.\n' +
    "- Vary which position holds the correct answer across questions.\n" +
    '- "explanation" is 1-2 sentences on why the correct option is right.\n' +
    "- Every question must be about the given subject and topic at the stated " +
    "difficulty."
  );
}

/* ------------------------------- providers ------------------------------- */

async function callGemini(
  system: string,
  msgs: Norm[],
  opts: GenOpts,
): Promise<GenResult> {
  const model = MODEL || DEFAULT_MODEL.gemini;
  const base = (BASE_URL || "https://generativelanguage.googleapis.com").replace(
    /\/+$/,
    "",
  );

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature,
    maxOutputTokens: opts.maxTokens,
  };
  if (opts.json) {
    generationConfig.responseMimeType = "application/json";
  }

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
        generationConfig,
      }),
    },
  );

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    providerFailure(resp, data, "Gemini");
  }

  const candidate = data?.candidates?.[0];
  const block = data?.promptFeedback?.blockReason;
  if (block) {
    console.error(`[ask-ai] Gemini blocked: ${block}`);
    throw new AiError({
      httpStatus: 502,
      code: "CONTENT_BLOCKED",
      publicMessage:
        "The AI couldn't answer that one. Try rewording your question.",
      detail: `blockReason=${block}`,
    });
  }

  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p?.text ?? "").join("").trim();
  return { text, truncated: candidate?.finishReason === "MAX_TOKENS" };
}

async function callOpenAI(
  system: string,
  msgs: Norm[],
  opts: GenOpts,
): Promise<GenResult> {
  const model = MODEL || DEFAULT_MODEL.openai;
  const base = (BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      ...msgs.map((m) => ({ role: m.role, content: m.text })),
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }

  const resp = await aiFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    providerFailure(resp, data, "OpenAI");
  }

  const choice = data?.choices?.[0];
  return {
    text: String(choice?.message?.content ?? "").trim(),
    truncated: choice?.finish_reason === "length",
  };
}

async function callAnthropic(
  system: string,
  msgs: Norm[],
  opts: GenOpts,
): Promise<GenResult> {
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
      system: opts.json
        ? system + "\n\nReturn only the JSON object, with no other text."
        : system,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      messages: msgs.map((m) => ({ role: m.role, content: m.text })),
    }),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    providerFailure(resp, data, "Anthropic");
  }

  const blocks = data?.content ?? [];
  return {
    text: blocks.map((b: { text?: string }) => b?.text ?? "").join("").trim(),
    truncated: data?.stop_reason === "max_tokens",
  };
}

function runProvider(
  system: string,
  msgs: Norm[],
  opts: GenOpts,
): Promise<GenResult> {
  if (PROVIDER === "openai") return callOpenAI(system, msgs, opts);
  if (PROVIDER === "anthropic") return callAnthropic(system, msgs, opts);
  return callGemini(system, msgs, opts);
}

/* --------------------------- structured parsing --------------------------- */

function parseJsonLoose(raw: string): Record<string, unknown> {
  let s = (raw ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    // fall through to a bracket-slice attempt
  }

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return JSON.parse(s.slice(first, last + 1)) as Record<string, unknown>;
  }

  throw new Error("Could not parse AI JSON output");
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

type Lesson = {
  title: string;
  introduction: string;
  explanation: string[];
  examples: string[];
  keyPoints: string[];
  summary: string;
};

type LessonResult =
  | { relevant: true; lesson: Lesson }
  | { relevant: false; suggestion: string };

function validateLesson(obj: Record<string, unknown>): LessonResult {
  // Default to relevant unless the model explicitly said otherwise, so a model
  // that omits the field never blocks a valid lesson.
  if (obj?.relevant === false) {
    const suggestion = String(obj?.suggestion ?? "").trim() ||
      "That topic looks like it belongs to a different subject. " +
        "Try another topic, or change the subject above.";
    return { relevant: false, suggestion };
  }

  const lesson: Lesson = {
    title: String(obj?.title ?? "").trim(),
    introduction: String(obj?.introduction ?? "").trim(),
    explanation: toStringArray(obj?.explanation),
    examples: toStringArray(obj?.examples),
    keyPoints: toStringArray(
      (obj as { keyPoints?: unknown; key_points?: unknown })?.keyPoints ??
        (obj as { key_points?: unknown })?.key_points,
    ),
    summary: String(obj?.summary ?? "").trim(),
  };

  if (
    !lesson.title ||
    !lesson.introduction ||
    lesson.explanation.length === 0 ||
    !lesson.summary
  ) {
    throw new Error("The lesson was missing required sections.");
  }

  return { relevant: true, lesson };
}

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

function resolveCorrectIndex(q: Record<string, unknown>, options: string[]): number {
  const raw = q?.correctIndex ?? q?.correct ?? q?.answerIndex;
  let idx = Number(raw);
  if (Number.isInteger(idx) && idx >= 0 && idx < 4) return idx;

  const answer = String(q?.answer ?? q?.correctAnswer ?? "").trim();
  if (answer) {
    const byText = options.findIndex(
      (o) => o.toLowerCase() === answer.toLowerCase(),
    );
    if (byText !== -1) return byText;

    if (/^[a-d]$/i.test(answer)) {
      idx = answer.toLowerCase().charCodeAt(0) - 97;
      if (idx >= 0 && idx < 4) return idx;
    }
  }

  return -1;
}

function validateQuiz(
  obj: Record<string, unknown>,
  wanted: number,
): { questions: QuizQuestion[] } {
  const rawList = Array.isArray((obj as { questions?: unknown })?.questions)
    ? ((obj as { questions: unknown[] }).questions)
    : [];

  const questions: QuizQuestion[] = [];

  for (const entry of rawList) {
    const q = (entry ?? {}) as Record<string, unknown>;
    const question = String(q?.question ?? q?.prompt ?? "").trim();
    const options = toStringArray(q?.options ?? q?.choices);
    const correctIndex = resolveCorrectIndex(q, options);
    const explanation = String(q?.explanation ?? q?.reason ?? "").trim();

    if (!question || options.length !== 4 || correctIndex === -1) {
      continue; // drop malformed questions instead of failing the whole quiz
    }

    questions.push({ question, options, correctIndex, explanation });
  }

  if (questions.length < Math.min(QUIZ_MIN, wanted)) {
    throw new Error("The quiz did not contain enough valid questions.");
  }

  return { questions: questions.slice(0, wanted) };
}

/* -------------------------------- helpers -------------------------------- */

function pickDifficulty(value: unknown): string {
  const wanted = String(value ?? "").trim().toLowerCase();
  return DIFFICULTIES.find((d) => d.toLowerCase() === wanted) ?? DIFFICULTIES[0];
}

function clampCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return QUIZ_DEFAULT;
  return Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, n));
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

/* ------------------------------ per-type flow ---------------------------- */

async function handleTutor(
  payload: Record<string, unknown>,
  topic: string,
  subject: string,
): Promise<Response> {
  const msgs = normalize(payload?.messages);
  if (!msgs.length) {
    return json({ text: "Ask me a question to get started.", truncated: false });
  }

  const system = buildTutorPrompt(topic, subject);

  // One request only — no automatic continuation call (it would consume more
  // quota). If it still hits the ceiling, `truncated` lets the UI invite a
  // follow-up question.
  const result = await runProvider(system, msgs, {
    maxTokens: MAX_TOKENS.tutor,
    temperature: TEMPERATURE.tutor,
    json: false,
  });

  return json({
    text: result.text || "Sorry, I couldn't generate a response this time.",
    truncated: result.truncated,
  });
}

async function handleLesson(
  topic: string,
  subject: string,
  difficulty: string,
): Promise<Response> {
  if (!topic) {
    return json({ error: "A topic is required to generate a lesson." }, 400);
  }

  const user: Norm[] = [
    {
      role: "user",
      text:
        "Create a lesson.\n" +
        `Subject: ${subject || "General"}\n` +
        `Topic: ${topic}\n` +
        `Difficulty: ${difficulty}`,
    },
  ];

  const result = await runProvider(LESSON_PROMPT, user, {
    maxTokens: MAX_TOKENS.lesson,
    temperature: TEMPERATURE.lesson,
    json: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonLoose(result.text);
  } catch {
    return json(
      { error: "The AI returned a lesson we could not read. Please try again." },
      502,
    );
  }

  try {
    const outcome = validateLesson(parsed);
    if (!outcome.relevant) {
      return json({ relevant: false, suggestion: outcome.suggestion });
    }
    return json({ relevant: true, lesson: outcome.lesson });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Invalid lesson output." },
      502,
    );
  }
}

async function handleQuiz(
  topic: string,
  subject: string,
  difficulty: string,
  count: number,
): Promise<Response> {
  if (!topic) {
    return json({ error: "A topic is required to generate a quiz." }, 400);
  }

  const user: Norm[] = [
    {
      role: "user",
      text:
        `Create a ${count}-question ${difficulty} quiz.\n` +
        `Subject: ${subject || "General"}\n` +
        `Topic: ${topic}`,
    },
  ];

  const result = await runProvider(quizPrompt(count), user, {
    maxTokens: MAX_TOKENS.quiz,
    temperature: TEMPERATURE.quiz,
    json: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonLoose(result.text);
  } catch {
    return json(
      { error: "The AI returned a quiz we could not read. Please try again." },
      502,
    );
  }

  try {
    return json({ quiz: validateQuiz(parsed, count) });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Invalid quiz output." },
      502,
    );
  }
}

/* -------------------------------- server -------------------------------- */

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

  if (!["gemini", "openai", "anthropic"].includes(PROVIDER)) {
    return json({ error: `Unknown AI_PROVIDER: ${PROVIDER}` }, 500);
  }

  if (REQUIRE_AUTH && !(await isSignedInUser(req.headers.get("Authorization")))) {
    return json({ error: "Sign in required" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const type = String(payload?.type ?? "tutor").toLowerCase().trim();
  if (!["tutor", "lesson", "quiz"].includes(type)) {
    return json({ error: `Unknown request type: ${type}` }, 400);
  }

  const topic = String(payload?.topic ?? "").trim();
  const subject = String(payload?.subject ?? "").trim();
  const difficulty = pickDifficulty(payload?.difficulty);

  try {
    if (type === "lesson") {
      return await handleLesson(topic, subject, difficulty);
    }
    if (type === "quiz") {
      return await handleQuiz(
        topic,
        subject,
        difficulty,
        clampCount(payload?.count),
      );
    }
    return await handleTutor(payload, topic, subject);
  } catch (err) {
    // Structured, student-safe errors. Full provider detail stays in the logs.
    if (err instanceof AiError) {
      console.error(`[ask-ai] ${err.code}: ${err.detail}`);
      const body: Record<string, unknown> = { error: err.message, code: err.code };
      if (typeof err.retryAfter === "number") {
        body.retryAfter = err.retryAfter;
      }
      return json(body, err.httpStatus);
    }

    console.error("[ask-ai] unhandled error:", err);
    return json(
      {
        error: "The AI service had a problem. Please try again in a moment.",
        code: "SERVER_ERROR",
      },
      502,
    );
  }
});
