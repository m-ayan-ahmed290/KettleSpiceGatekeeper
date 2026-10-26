const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const guildId2 = 'roles-guild';
const settingsPath = require.resolve('../utilities/guildSettings');
require.cache[settingsPath] = { id: settingsPath, filename: settingsPath, loaded: true, exports: { getGuildSettings: async () => ({ features: { roles: true }, roles: [{ sources: ['source'], target: 'target' }] }) } };
const calls = [];
const guild = { id: guildId2, members: { async list(options) {
  calls.push(options);
  await new Promise(resolve => setImmediate(resolve));
  const count = calls.length === 1 ? 100 : 1;
  return new Collection(Array.from({ length: count }, (_, n) => [String(n), { id: String(n), guild, user: { bot: true }, roles: { cache: new Collection() } }]));
} } };
const clientPath = require.resolve('../utilities/client');
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { guilds: { cache: new Map([[guildId2, guild]]) } } };
const { assignRolesToAllMembers } = require('../utilities/functions');
test('role refresh pages without caching and coalesces concurrent refreshes', async () => {
  const first = assignRolesToAllMembers(guild), second = assignRolesToAllMembers(guild);
  assert.equal(first, second);
  await first;
  assert.deepEqual(calls, [{ limit: 100, after: undefined, cache: false }, { limit: 100, after: '99', cache: false }]);
});
