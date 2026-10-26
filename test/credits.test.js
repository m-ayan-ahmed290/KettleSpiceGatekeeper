const { test } = require('node:test');
const assert = require('node:assert/strict');
const modelPath = require.resolve('../schemas/credits');
const balances = new Map(), seen = new Map(), blocked = new Set();
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  async init() {},
  async updateOne(query, update) {
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(query.GuildID);
    if (!update.$inc) return;
    const key = `${query.GuildID}:${query.UserID}`;
    if (!seen.has(key)) seen.set(key, new Set());
    if (blocked.has(key) || (query.RecentSources && seen.get(key).has(query.RecentSources.$ne))) return;
    assert.equal(query.Blocked.$ne, true);
    balances.set(key, (balances.get(key) || 0) + update.$inc.Credits);
    if (update.$push.RecentSources) seen.get(key).add(update.$push.RecentSources.$each[0]);
  },
} };
const { awardCredits } = require('../utilities/awardCredits');
test('concurrent awards use atomic increments and suppress replay IDs', async () => {
  await Promise.all(Array.from({ length: 100 }, (_, i) => awardCredits({ guildId: 'a', userId: 'mod', credits: 6, reason: 'Timeout', sourceId: String(i % 50) })));
  assert.equal(balances.get('a:mod'), 300);
  blocked.add('a:mod');
  await awardCredits({ guildId: 'a', userId: 'mod', credits: 6, reason: 'Timeout', sourceId: 'new' });
  assert.equal(balances.get('a:mod'), 300);
});
test('balances, blocked status and event deduplication do not leak across guilds', async () => {
  await awardCredits({ guildId: 'b', userId: 'mod', credits: 6, reason: 'Timeout', sourceId: 'new' });
  assert.equal(balances.get('b:mod'), 6); assert.equal(balances.get('a:mod'), 300);
});
