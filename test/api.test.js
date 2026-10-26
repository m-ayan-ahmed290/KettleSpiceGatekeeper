const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { IncomingMessage, ServerResponse } = require("node:http");
const { Socket } = require("node:net");
const { Collection } = require("discord.js");
process.env.BOT_API_SECRET = "test-only-secret";
process.env.BOT_API_PORT = "0";
process.env.GUILD_ID = "test-guild";
const { createApiApp } = require("../api/server");
let listOptions;
const guild = { members: { async list(options) { listOptions = options; return new Collection(); } } };
const app = createApiApp({ isReady: () => false, guilds: { cache: new Map([["test-guild", guild]]) }, ws: { ping: 1 } });
const base = "http://example.test";
// Exercise Express middleware and routing without binding a TCP port.
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.url = new URL(url).pathname + new URL(url).search;
    req.method = options.method || "GET";
    req.headers = { ...options.headers };
    if (options.body) req.headers["content-length"] = String(Buffer.byteLength(options.body));
    const res = new ServerResponse(req);
    res.end = body => { resolve({ status: res.statusCode, json: async () => JSON.parse(String(body)) }); return res; };
    app.handle(req, res, reject);
    if (options.body) req.push(options.body);
    req.push(null);
  });
}
test("health is public and reports unavailable dependencies", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false });
});
test("dashboard rejects missing and incorrect secrets", async () => {
  for (const headers of [{}, { "x-bot-secret": "wrong" }]) {
    assert.equal((await fetch(`${base}/bot/stats`, { headers })).status, 401);
  }
});
test("member requests use bounded REST pagination with no cache", async () => {
  const res = await fetch(`${base}/bot/guild/members?limit=-2`, { headers: { "x-bot-secret": "test-only-secret" } });
  assert.equal(res.status, 200);
  assert.deepEqual(listOptions, { limit: 100, after: undefined, cache: false });
  assert.equal((await fetch(`${base}/bot/guild/members?after=invalid`, { headers: { "x-bot-secret": "test-only-secret" } })).status, 400);
});
test("invalid timeout durations fail before calling Discord", async () => {
  const res = await fetch(`${base}/bot/timeout`, { method: "POST", headers: { "x-bot-secret": "test-only-secret", "content-type": "application/json" }, body: JSON.stringify({ userId: "123456789012345678", durationMs: -1 }) });
  assert.equal(res.status, 400);
});
