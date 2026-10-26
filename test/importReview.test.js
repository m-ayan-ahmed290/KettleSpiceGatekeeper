const { test } = require('node:test');
const assert = require('node:assert/strict');
let query;
const modelPath = require.resolve('../schemas/importReview');
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  find(value) { query = value; return { sort() { return this; }, skip() { return this; }, limit(n) { assert.equal(n, 3); return this; }, lean: async () => [] }; },
} };
const command = require('../commands/migration-review');
test('migration review is read-only, guild-scoped and optionally filtered by user', async () => {
  let reply;
  await command.execute({ guild: { id: 'current' }, options: { getUser: () => ({ id: 'mod' }), getInteger: () => 1 },
    deferReply: async () => {}, editReply: async text => { reply = text; } });
  assert.deepEqual(query, { GuildID: 'current', 'Identity.UserID': 'mod' });
  assert.match(reply, /No legacy import warnings/);
});
