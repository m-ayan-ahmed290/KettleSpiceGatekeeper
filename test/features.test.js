const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, PermissionsBitField } = require('discord.js');
const { parseDuration } = require('../utilities/duration');
const { enterCommand } = require('../utilities/commandGuard');
const { crc32 } = require('../scripts/package');
test('duration parsing enforces minimum, maximum and valid units', () => {
  assert.equal(parseDuration('30m'), 1800000);
  assert.equal(parseDuration('2H'), 7200000);
  assert.equal(parseDuration('365d'), 365 * 86400000);
  for (const value of ['0m', '-1h', '59s', '366d', '1.5h', 'tomorrow', '1m garbage']) assert.equal(parseDuration(value), null);
});
test('command guard bounds concurrency, applies cooldown and releases once', () => {
  const slots = Array.from({ length: 8 }, (_, n) => enterCommand(`user${n}`, 100));
  assert.ok(enterCommand('overflow', 100).error);
  for (const slot of slots) { slot.release(); slot.release(); }
  assert.ok(enterCommand('user0', 101).error);
  const next = enterCommand('user0', 2100); assert.equal(next.error, undefined); next.release();
});
test('ZIP CRC uses the standard CRC32 polynomial', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});
test('poll rejects repeated choices without posting', async () => {
  let reply;
  await require('../commands/poll').execute({ options: { getString: name => name === 'question' ? 'Tea?' : 'Tea | tea' }, reply: async p => { reply = p; } });
  assert.equal(reply.ephemeral, true);
  assert.match(reply.content, /different/);
});
test('poll posts reaction choices sequentially without collectors', async () => {
  const reactions = [];
  let reply;
  await require('../commands/poll').execute({
    options: { getString: name => name === 'question' ? 'Drink?' : 'Tea | Coffee' },
    guild: { members: { me: {} } }, user: { username: 'Alice' },
    channel: { permissionsFor: () => ({ has: () => true }) },
    reply: async p => { reply = p; return { react: async emoji => { reactions.push(emoji); } }; },
  });
  assert.equal(reactions.length, 2); assert.match(reply.embeds[0].toJSON().description, /Coffee/);
});
test('purge filters old and other-user messages before deletion', async () => {
  const recent = new Collection([
    ['a', { id: 'a', author: { id: 'target' }, createdTimestamp: Date.now() }],
    ['b', { id: 'b', author: { id: 'other' }, createdTimestamp: Date.now() }],
    ['c', { id: 'c', author: { id: 'target' }, createdTimestamp: Date.now() - 15 * 86400000 }],
  ]);
  let selected, reply;
  await require('../commands/purge').execute({
    guild: { members: { me: {} } }, options: { getInteger: () => 10, getUser: () => ({ id: 'target', username: 'Target' }) },
    deferReply: async () => {}, editReply: async p => { reply = p; },
    channel: { permissionsFor: () => ({ has: () => true }), messages: { fetch: async options => { assert.equal(options.cache, false); return recent; } },
      bulkDelete: async messages => { selected = messages; return new Collection(messages.map(m => [m.id, m])); } },
  });
  assert.deepEqual(selected.map(m => m.id), ['a']); assert.match(reply.content, /Deleted 1/);
});
test('slowmode supports disabling and verifies the bot permission', async () => {
  let seconds, reply;
  await require('../commands/slowmode').execute({ guild: { members: { me: {} } }, user: { tag: 'Alice' }, options: { getInteger: () => 0 },
    channel: { setRateLimitPerUser: async value => { seconds = value; }, permissionsFor: () => ({ has: () => true }) },
    deferReply: async () => {}, editReply: async p => { reply = p; } });
  assert.equal(seconds, 0); assert.match(reply.content, /disabled/);
});
