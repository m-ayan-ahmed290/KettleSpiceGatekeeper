const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { IncomingMessage, ServerResponse } = require("node:http");
const { Socket } = require("node:net");
const { Collection } = require("discord.js");
process.env.BOT_API_SECRET = "test-only-secret";
process.env.BOT_API_PORT = "0";
process.env.GUILD_ID = "111111111111111111";
const queries = [];
const creditPath = require.resolve("../schemas/credits");
require.cache[creditPath] = { id: creditPath, filename: creditPath, loaded: true, exports: {
  find(query) { queries.push(query); return { select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] }; },
  findOne(query) { queries.push(query); return { slice() { return this; }, lean: async () => null }; },
  findOneAndUpdate: async query => { queries.push(query); return { Credits: 1 }; },
} };
const { createApiApp } = require("../api/server");
let listOptions;
const guild = { members: { async list(options) { listOptions = options; return new Collection(); } } };
const testClient = { isReady: () => false, guilds: { cache: new Map([["111111111111111111", guild], ["222222222222222222", guild]]) }, ws: { ping: 1 } };
const app = createApiApp(testClient);
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

test("dashboard credit reads and writes use the selected guild identity", async () => {
  const headers = { "x-bot-secret": "test-only-secret", "x-guild-id": "222222222222222222", "content-type": "application/json" };
  assert.equal((await fetch(`${base}/bot/credits`, { headers })).status, 200);
  assert.deepEqual(queries.at(-1), { GuildID: "222222222222222222" });
  const res = await fetch(`${base}/bot/credits/adjust`, { method: "POST", headers, body: JSON.stringify({ userId: "123456789012345678", amount: 1, reason: "correction" }) });
  assert.equal(res.status, 200);
  assert.deepEqual(queries.at(-1), { GuildID: "222222222222222222", UserID: "123456789012345678" });
});
test("dashboard rejects unjoined guild IDs and offers authenticated guild discovery", async () => {
  assert.equal((await fetch(`${base}/bot/credits?guildId=333333333333333333`, { headers: { "x-bot-secret": "test-only-secret" } })).status, 404);
  assert.equal((await fetch(`${base}/bot/guilds`, { headers: { "x-bot-secret": "test-only-secret" } })).status, 200);
});

test("dashboard cannot mutate records before legacy import is complete", async () => {
  testClient.dataReady = false;
  try {
    const before = queries.length;
    const res = await fetch(`${base}/bot/credits/adjust`, { method: "POST", headers: { "x-bot-secret": "test-only-secret", "content-type": "application/json" }, body: JSON.stringify({ userId: "123456789012345678", amount: 1, reason: "test" }) });
    assert.equal(res.status, 503); assert.equal(queries.length, before);
  } finally { delete testClient.dataReady; }
});
