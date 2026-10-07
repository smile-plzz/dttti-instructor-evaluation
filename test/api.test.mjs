import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/portal.mjs";
async function call(req) {
  let headers = {};
  let text;
  const res = { setHeader: (n, v) => (headers[n] = v), end: (v) => (text = v) };
  await handler(req, res);
  return { status: res.statusCode, headers, body: JSON.parse(text) };
}
test("unconfigured backend reports status and fails closed", async () => {
  delete process.env.SUPABASE_URL;
  const r = await call({ method: "GET", headers: {} });
  assert.equal(r.body.configured, false);
  const post = await call({
    method: "POST",
    headers: {
      origin: "https://example.com",
      host: "example.com",
      "content-type": "application/json",
    },
    body: { action: "submit" },
  });
  assert.equal(post.status, 503);
  assert.equal(post.headers["Cache-Control"], "no-store");
});
test("cross-origin submission rejected before processing", async () => {
  const r = await call({
    method: "POST",
    headers: {
      origin: "https://other.com",
      host: "example.com",
      "content-type": "application/json",
    },
    body: { action: "submit" },
  });
  assert.equal(r.status, 403);
});
test("unsupported method is rejected", async () => {
  assert.equal((await call({ method: "DELETE", headers: {} })).status, 405);
});
test("live report API returns summaries instead of individual ratings", async () => {
  process.env.SUPABASE_URL = "https://database.example";
  process.env.SUPABASE_PUBLISHABLE_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server";
  const original = globalThis.fetch;
  const rows = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    ratings: Array(8).fill(4),
    good: i === 0 ? "Helpful" : "",
    improve: "",
  }));
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url.endsWith("/auth/v1/user")
        ? { id: "staff" }
        : {
            version: 1,
            instructors: [{ id: "teacher", name: "Teacher", count: 5, rows }],
          },
  });
  try {
    const r = await call({
      method: "POST",
      headers: {
        origin: "https://example.com",
        host: "example.com",
        "content-type": "application/json",
        cookie: "dttti_session=token",
      },
      body: { action: "report", data: { id: "event" } },
    });
    assert.equal(r.status, 200);
    const t = r.body.instructors[0];
    assert.equal(t.summary.overall, 4);
    assert.equal(t.comments.length, 1);
    assert.ok(!("rows" in t));
    assert.ok(!JSON.stringify(r.body).includes("server"));
  } finally {
    globalThis.fetch = original;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
