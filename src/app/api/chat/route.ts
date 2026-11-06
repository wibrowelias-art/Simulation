import { generateText } from "ai";
import { instructions, parseReply, parseScene, promptText, sanitize, sanitizeScene, sceneInstructions, scenePrompt } from "@/lib/live/prompt";

export const runtime = "nodejs";
export const maxDuration = 20;

/** Order: Google Gemini direct (GEMINI_API_KEY), else AI Gateway; the client falls back to scripted replies on any failure. */

/** Model is configurable; default is a fast, cheap one. Auth: Vercel OIDC (automatic on Vercel) or AI_GATEWAY_API_KEY. */
const MODEL = process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACKS = (process.env.AI_GATEWAY_FALLBACKS ?? "openai/gpt-4.1-nano").split(",").map((x) => x.trim()).filter(Boolean);

// best-effort per-instance rate limit (each serverless instance keeps its own window)
const WINDOW = 60_000, PER_IP = 30;
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const h = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (h.length >= PER_IP) { hits.set(ip, h); return true; }
  h.push(now);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return false;
}

function errCode(e: unknown): { status: number; code: string } {
  const s = String((e as { message?: string })?.message ?? e).toLowerCase();
  const st = Number((e as { statusCode?: number })?.statusCode) || 0;
  if (s.includes("customer_verification_required") || s.includes("verification") || s.includes("credit card")) return { status: 402, code: "customer_verification_required" };
  if (st === 402 || s.includes("insufficient")) return { status: 402, code: "insufficient_funds" };
  if (st === 401 || st === 403 || s.includes("unauthenticated") || s.includes("api key") || s.includes("oidc")) return { status: 401, code: "no_auth" };
  if (st === 429 || s.includes("rate")) return { status: 429, code: "rate_limited" };
  if (s.includes("timeout") || s.includes("abort")) return { status: 504, code: "timeout" };
  return { status: 502, code: "model_error" };
}

/** direct Google Gemini call (server only; the key never leaves the server) */
const GEMINI_MODELS = (process.env.GEMINI_MODEL ?? "gemini-3.6-flash,gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-3.5-flash-lite").split(",").map((x) => x.trim()).filter(Boolean);
class HttpError extends Error { constructor(public statusCode: number, msg: string) { super(msg); } }
const SAFETY = ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" }));
interface Job { system: string; prompt: string; maxTokens: number; parse: (text: string) => Record<string, unknown> | undefined }
async function gemini(job: Job, key: string, model: string, ms: number, outer: AbortSignal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const onAbort = () => ctl.abort();
  outer.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: job.system }] },
        contents: [{ role: "user", parts: [{ text: job.prompt }] }],
        generationConfig: { temperature: 1, maxOutputTokens: job.maxTokens, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" } },
        safetySettings: SAFETY,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string }; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    if (!res.ok) throw new HttpError(res.status, `gemini ${res.status} ${j.error?.status ?? ""}`);
    const text = (j.candidates?.[0]?.content?.parts ?? []).filter((x) => !x.thought).map((x) => x.text ?? "").join("");
    return { text, model, usage: { in: j.usageMetadata?.promptTokenCount ?? 0, out: j.usageMetadata?.candidatesTokenCount ?? 0 } };
  } finally { clearTimeout(timer); outer.removeEventListener("abort", onAbort); }
}

/* identical requests (double taps, two tabs, retries) within a short window share one answer */
const CACHE_MS = 20_000;
const cache = new Map<string, { t: number; body: Record<string, unknown> }>();
async function cacheKey(job: Job) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(job.system + "\u0000" + job.prompt));
  return Buffer.from(buf).toString("base64url");
}
function cached(k: string) {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.body;
  if (hit) cache.delete(k);
}
function store(k: string, body: Record<string, unknown>) {
  if (cache.size > 300) for (const [key, v] of cache) if (Date.now() - v.t >= CACHE_MS || cache.size > 200) cache.delete(key);
  cache.set(k, { t: Date.now(), body });
}
/** short, scrubbed reason for logs: never a key, token or long id */
const scrub = (e: unknown) => String((e as Error)?.message ?? e).replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]").replace(/key=[^&\s]+/gi, "key=[redacted]").slice(0, 160);

function jobFor(body: unknown): Job | undefined {
  if ((body as { kind?: unknown })?.kind === "scene") {
    const r = sanitizeScene(body);
    if (!r) return;
    const cast = r.cast.map((c) => c.username);
    return { system: sceneInstructions(r), prompt: scenePrompt(r), maxTokens: 120 + r.lines * 70, parse: (t) => { const lines = parseScene(t, cast, r.lines + 2, r.player); return lines.length ? { lines } : undefined; } };
  }
  const r = sanitize(body);
  if (!r) return;
  return { system: instructions(r), prompt: promptText(r), maxTokens: 300, parse: (t) => { const { lines, remember, meme } = parseReply(t, r.persona.username); return lines.length ? { lines, remember, meme } : undefined; } };
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) return Response.json({ error: "slow down", code: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "bad json", code: "bad_request" }, { status: 400 }); }
  if (JSON.stringify(body ?? null).length > 24_000) return Response.json({ error: "too big", code: "bad_request" }, { status: 413 });
  const job = jobFor(body);
  if (!job) return Response.json({ error: "missing fields", code: "bad_request" }, { status: 400 });
  const k = await cacheKey(job);
  const hit = cached(k);
  if (hit) return Response.json({ ...hit, cached: true });
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    // Google latency swings a lot: ask two fast models at once and take the first usable answer
    const ctl = new AbortController();
    const ask = async (model: string, ms: number) => {
      const out = await gemini(job, key, model, ms, ctl.signal);
      const parsed = job.parse(out.text);
      if (!parsed) throw new Error("empty");
      return { ...parsed, model: out.model, usage: out.usage };
    };
    let errs: unknown[] = [];
    try {
      const won = await Promise.any(GEMINI_MODELS.slice(0, 2).map((m) => ask(m, 9_000)));
      ctl.abort();
      store(k, won);
      return Response.json(won);
    } catch (e) {
      errs = e instanceof AggregateError ? [...e.errors] : [e];
    }
    // Both fast models failed (often a brief per-model rate limit): try the backups one at a time
    if (!errs.some((x) => errCode(x).code === "no_auth")) {
      for (const m of GEMINI_MODELS.slice(2)) {
        try { const out = await ask(m, 3_500); store(k, out); return Response.json(out); } catch (e) { errs.push(e); }
      }
    }
    const c = errCode(errs.find((x) => errCode(x).code === "no_auth") ?? errs[0]);
    console.error("chat route (gemini):", c.code, errs.map((x) => scrub(x).slice(0, 80)).join(" | "));
    return Response.json({ error: "model unavailable", code: c.code, status: c.status }, { status: c.code === "no_auth" ? 200 : c.status });
  }
  try {
    const out = await generateText({
      model: MODEL,
      instructions: job.system,
      prompt: job.prompt,
      maxOutputTokens: job.maxTokens,
      temperature: 1,
      maxRetries: 0,
      timeout: 8000,
      providerOptions: { gateway: { models: FALLBACKS } },
    });
    const parsed = job.parse(out.text);
    if (!parsed) return Response.json({ error: "empty", code: "empty" }, { status: 502 });
    const resBody = { ...parsed, model: out.response?.modelId ?? MODEL, usage: { in: out.usage?.inputTokens ?? 0, out: out.usage?.outputTokens ?? 0 } };
    store(k, resBody);
    return Response.json(resBody);
  } catch (e) {
    const c = errCode(e);
    const detail = scrub(e);
    console.error("chat route:", c.code, detail);
    // setup problems (no card / no key / no funds) are expected states, not request failures: answer 200 so the
    // browser does not log a red error on every page; the client switches to the built-in replies for the session
    const setup = c.code === "customer_verification_required" || c.code === "insufficient_funds" || c.code === "no_auth";
    return Response.json({ error: "model unavailable", code: c.code, status: c.status, detail }, { status: setup ? 200 : c.status });
  }
}
