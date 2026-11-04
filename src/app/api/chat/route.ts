import { generateText } from "ai";
import { instructions, parseReply, promptText, sanitize, type LiveRequest } from "@/lib/live/prompt";

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
async function gemini(r: LiveRequest, key: string, model: string, ms: number, outer: AbortSignal) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  outer.addEventListener("abort", () => ctl.abort());
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions(r) }] },
        contents: [{ role: "user", parts: [{ text: promptText(r) }] }],
        generationConfig: { temperature: 1, maxOutputTokens: 300, responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" } },
        safetySettings: ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((category) => ({ category, threshold: "BLOCK_MEDIUM_AND_ABOVE" })),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: { status?: string; message?: string }; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    if (!res.ok) throw new HttpError(res.status, `gemini ${res.status} ${j.error?.status ?? ""}`);
    const text = (j.candidates?.[0]?.content?.parts ?? []).filter((x) => !x.thought).map((x) => x.text ?? "").join("");
    return { text, model, usage: { in: j.usageMetadata?.promptTokenCount ?? 0, out: j.usageMetadata?.candidatesTokenCount ?? 0 } };
  } finally { clearTimeout(timer); }
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) return Response.json({ error: "slow down", code: "rate_limited" }, { status: 429 });
  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: "bad json", code: "bad_request" }, { status: 400 }); }
  if (JSON.stringify(body ?? null).length > 24_000) return Response.json({ error: "too big", code: "bad_request" }, { status: 413 });
  const r = sanitize(body);
  if (!r) return Response.json({ error: "missing fields", code: "bad_request" }, { status: 400 });
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    // Google latency swings a lot: ask two fast models at once and take the first usable answer
    const ctl = new AbortController();
    const ask = async (model: string, ms: number) => {
      const out = await gemini(r, key, model, ms, ctl.signal);
      const { lines, remember } = parseReply(out.text, r.persona.username);
      if (!lines.length) throw new Error("empty");
      return { lines, remember, model: out.model, usage: out.usage };
    };
    let errs: unknown[] = [];
    try {
      const won = await Promise.any(GEMINI_MODELS.slice(0, 2).map((m) => ask(m, 9_000)));
      ctl.abort();
      return Response.json(won);
    } catch (e) {
      errs = e instanceof AggregateError ? [...e.errors] : [e];
    }
    // Both fast models failed (often a brief per-model rate limit): try the backups one at a time
    if (!errs.some((x) => errCode(x).code === "no_auth")) {
      for (const m of GEMINI_MODELS.slice(2)) {
        try { return Response.json(await ask(m, 3_500)); } catch (e) { errs.push(e); }
      }
    }
    const c = errCode(errs.find((x) => errCode(x).code === "no_auth") ?? errs[0]);
    console.error("chat route (gemini):", c.code, errs.map((x) => String((x as Error)?.message ?? x).slice(0, 80)).join(" | "));
    return Response.json({ error: "model unavailable", code: c.code, status: c.status }, { status: c.code === "no_auth" ? 200 : c.status });
  }
  try {
    const out = await generateText({
      model: MODEL,
      instructions: instructions(r),
      prompt: promptText(r),
      maxOutputTokens: 300,
      temperature: 1,
      maxRetries: 0,
      timeout: 8000,
      providerOptions: { gateway: { models: FALLBACKS } },
    });
    const { lines, remember } = parseReply(out.text, r.persona.username);
    if (!lines.length) return Response.json({ error: "empty", code: "empty" }, { status: 502 });
    return Response.json({ lines, remember, model: out.response?.modelId ?? MODEL, usage: { in: out.usage?.inputTokens ?? 0, out: out.usage?.outputTokens ?? 0 } });
  } catch (e) {
    const c = errCode(e);
    console.error("chat route:", c.code, String((e as Error)?.message ?? e).slice(0, 300));
    // short, scrubbed reason (no secrets): helps tell "needs a payment method" apart from "no credentials"
    const detail = String((e as Error)?.message ?? e).replace(/[A-Za-z0-9_\-]{32,}/g, "[redacted]").slice(0, 200);
    // setup problems (no card / no key / no funds) are expected states, not request failures: answer 200 so the
    // browser does not log a red error on every page; the client switches to the built-in replies for the session
    const setup = c.code === "customer_verification_required" || c.code === "insufficient_funds" || c.code === "no_auth";
    return Response.json({ error: "model unavailable", code: c.code, status: c.status, detail }, { status: setup ? 200 : c.status });
  }
}
