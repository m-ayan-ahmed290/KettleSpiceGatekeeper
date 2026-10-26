const { test } = require("node:test");
const assert = require("node:assert/strict");
const modelPath = require.resolve("../schemas/credits");
let balance = 0, blocked = false;
const seen = new Set();
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  async init() {},
  async updateOne(query, update) {
    await new Promise(resolve => setImmediate(resolve));
    if (!update.$inc) return;
    assert.equal(query.Blocked.$ne, true);
    assert.equal(update.$inc.Credits, 6);
    if (blocked || (query.RecentSources && seen.has(query.RecentSources.$ne))) return;
    balance += update.$inc.Credits;
    if (update.$push.RecentSources) seen.add(update.$push.RecentSources.$each[0]);
  },
} };
const { awardCredits } = require("../utilities/awardCredits");
test("concurrent awards use atomic increments and suppress replay IDs", async () => {
  await Promise.all(Array.from({ length: 100 }, (_, i) => awardCredits({ userId: "mod", credits: 6, reason: "Timeout", sourceId: String(i % 50) })));
  assert.equal(balance, 300);
  blocked = true;
  await awardCredits({ userId: "mod", credits: 6, reason: "Timeout", sourceId: "new" });
  assert.equal(balance, 300);
});
