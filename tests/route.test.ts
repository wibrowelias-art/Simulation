import { afterEach, describe, expect, it, vi } from "vitest";

const KEY = "AIzaTESTKEY-do-not-log-1234567890abcdef";
const body = (extra: Record<string, unknown> = {}) => ({ kind: "scene", mode: "ambient", cast: [{ username: "kai" }, { username: "mira" }], lines: 3, place: { server: "GOD HQ", channel: "general" }, ...extra });
const req = (b: unknown, ip = "1.1.1.1") => new Request("http://x/api/chat", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(b) });
const gemini = (text: string, status = 200) => new Response(JSON.stringify(status === 200 ? { candidates: [{ content: { parts: [{ text }] } }] } : { error: { status: "PERMISSION_DENIED", message: `bad key ${KEY}` } }), { status });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

describe("/api/chat", () => {
  it("answers scenes, and identical requests within a few seconds share one model call", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    const fetchMock = vi.fn(async () => gemini(JSON.stringify({ lines: [{ who: "kai", text: "nah", to: "mira" }, { who: "mira", text: "yeah", to: "kai" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const { POST } = await import("../src/app/api/chat/route");
    const a = await (await POST(req(body()))).json();
    expect(a.lines).toHaveLength(2);
    const calls = fetchMock.mock.calls.length;
    const b = await (await POST(req(body(), "2.2.2.2"))).json();
    expect(b.cached).toBe(true);
    expect(fetchMock.mock.calls.length).toBe(calls);
    await POST(req(body({ about: "something else" }), "3.3.3.3"));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
    // the key goes in a header to Google, never in the URL
    for (const [url] of fetchMock.mock.calls as unknown as [string][]) expect(String(url)).not.toContain(KEY);
  });

  it("never logs the key when the model fails, and tells the client to fall back", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    vi.stubGlobal("fetch", vi.fn(async () => gemini("", 403)));
    const logs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
    const { POST } = await import("../src/app/api/chat/route");
    const r = await POST(req(body(), "4.4.4.4"));
    const j = await r.json();
    expect(j.code).toBe("no_auth");
    expect(r.status).toBe(200);
    expect(logs.join("\n")).not.toContain(KEY);
    expect(JSON.stringify(j)).not.toContain(KEY);
  });

  it("rejects bad and oversized bodies", async () => {
    const { POST } = await import("../src/app/api/chat/route");
    expect((await POST(req({ kind: "scene", cast: [] }, "5.5.5.5"))).status).toBe(400);
    expect((await POST(req({ ...body(), pad: "x".repeat(30_000) }, "6.6.6.6"))).status).toBe(413);
  });
});
