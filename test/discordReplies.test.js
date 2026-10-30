const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./discordFixture');
const { runCommand } = require('../utilities/runCommand');

test('setup view completes its deferred reply using the actual Discord 14 REST serializer', async () => {
  const f = fixture('setup', [{ type: 1, name: 'view' }]);
  try {
    await runCommand(require('../commands/setup'), f.interaction);
    assert.equal(f.interaction.deferred, true); assert.equal(f.interaction.replied, true);
    assert.equal(f.requests[0].body.type, 5);
    assert.equal(f.requests[1].method, 'PATCH');
    assert.match(f.requests[1].body.content, /Server configuration/);
    assert.equal(f.requests.filter(r => r.body?.type === 5).length, 1);
  } finally { f.client.destroy(); }
});
test('a caught error follow-up completes the initial deferred message instead of leaving a spinner', async () => {
  const f = fixture('help');
  try {
    await runCommand({ data: { name: 'help' }, async execute(i) {
      await i.deferReply({ ephemeral: true });
      return i.followUp({ content: 'Database unavailable', ephemeral: true });
    } }, f.interaction);
    assert.equal(f.requests.at(-1).method, 'PATCH');
    assert.equal(f.requests.at(-1).body.content, 'Database unavailable');
    assert.equal(f.interaction.replied, true);
  } finally { f.client.destroy(); }
});
test('central dispatcher replaces the thinking response when a deferred command throws', async () => {
  const f = fixture('broken');
  f.client.commands = new Map([['broken', { data: { name: 'broken', toJSON: () => ({}) }, async execute(i) {
    await i.deferReply({ ephemeral: true }); throw new Error('Offline regression failure');
  } }]]);
  try {
    await require('../events/interactionCreate').execute(f.interaction);
    assert.equal(f.requests.at(-1).method, 'PATCH');
    assert.match(f.requests.at(-1).body.content, /error while executing/);
    assert.equal(f.interaction.replied, true);
  } finally { f.client.destroy(); }
});
test('timer-based deferral still returns a real editable Message for game and poll controls', async () => {
  const f = fixture('game');
  try {
    const result = await runCommand({ data: { name: 'game' }, async execute(i) {
      await new Promise(resolve => setTimeout(resolve, 10));
      return i.reply({ content: 'Game ready', fetchReply: true });
    } }, f.interaction, 1);
    assert.equal(result.id, '500000000000000001');
    assert.equal(typeof result.createMessageComponentCollector, 'function');
    assert.equal(f.interaction.ephemeral, false);
  } finally { f.client.destroy(); }
});
test('slow REST replies cannot race the acknowledgement timer into a second callback', async () => {
  const f = fixture('help');
  const post = f.client.rest.post;
  f.client.rest.post = async (...args) => { await new Promise(resolve => setTimeout(resolve, 20)); return post(...args); };
  try {
    await runCommand({ data: { name: 'help' }, execute: i => i.reply({ content: 'Hello' }) }, f.interaction, 1);
    assert.deepEqual(f.requests.map(r => r.body?.type), [4]);
    assert.equal(f.interaction.replied, true);
  } finally { f.client.destroy(); }
});
test('slow commands replace the spinner with a status, then replace that status with the eventual result', async () => {
  const f = fixture('help');
  try {
    await runCommand({ data: { name: 'help' }, async execute(i) {
      await i.deferReply({ ephemeral: true });
      await new Promise(resolve => setTimeout(resolve, 30));
      return i.reply({ content: 'Finished safely' });
    } }, f.interaction, 1, 5);
    const edits = f.requests.filter(r => r.method === 'PATCH');
    assert.equal(edits.length, 2);
    assert.match(edits[0].body.content, /taking longer/);
    assert.equal(edits[1].body.content, 'Finished safely');
  } finally { f.client.destroy(); }
});
test('migration review completes its deferred reply with no warnings and remains guild scoped', async () => {
  const Review = require('../schemas/importReview'), original = Review.find;
  const f = fixture('migration-review');
  Review.find = query => {
    assert.deepEqual(query, { GuildID: f.guild.id });
    return { sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [] };
  };
  try {
    await runCommand(require('../commands/migration-review'), f.interaction);
    assert.equal(f.interaction.replied, true);
    assert.match(f.requests.at(-1).body.content, /No legacy import warnings/);
  } finally { Review.find = original; f.client.destroy(); }
});
test('remind set saves once and completes its real Discord deferred confirmation', async () => {
  const Reminder = require('../schemas/reminder');
  const original = { countDocuments: Reminder.countDocuments, create: Reminder.create };
  let writes = 0;
  const f = fixture('remind', [{ type: 1, name: 'set', options: [{ type: 3, name: 'when', value: '5m' }, { type: 3, name: 'text', value: 'Tea time' }] }]);
  Reminder.countDocuments = async () => 0;
  Reminder.create = async data => { writes++; return { ...data, _id: '100000000000000000000001' }; };
  try {
    await runCommand(require('../commands/remind'), f.interaction);
    assert.equal(writes, 1); assert.equal(f.interaction.replied, true);
    assert.match(f.requests.at(-1).body.content, /I'll DM you/);
  } finally { Object.assign(Reminder, original); f.client.destroy(); }
});
