const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { guildId2 } = require('../config.json');
const calls = [];
const guild = { members: { async list(options) {
  calls.push(options);
  await new Promise(resolve => setImmediate(resolve));
  const count = calls.length === 1 ? 100 : 1;
  return new Collection(Array.from({ length: count }, (_, n) => [String(n), { id: String(n), roles: { cache: new Collection() } }]));
} } };
const clientPath = require.resolve('../utilities/client');
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { guilds: { cache: new Map([[guildId2, guild]]) } } };
const { assignRolesToAllMembers } = require('../utilities/functions');
test('role refresh pages without caching and coalesces concurrent refreshes', async () => {
  const first = assignRolesToAllMembers(), second = assignRolesToAllMembers();
  assert.equal(first, second);
  await first;
  assert.deepEqual(calls, [{ limit: 100, after: undefined, cache: false }, { limit: 100, after: '99', cache: false }]);
});
