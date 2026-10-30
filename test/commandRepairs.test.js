const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./discordFixture');
const { runCommand } = require('../utilities/runCommand');
test('manual role assignment fetches a GuildMember through the supported Discord manager', async () => {
  let assigned;
  const user = { id: 'target', username: 'Target' }, role = { id: 'role', name: 'Member', guild: { id: 'guild' }, managed: false };
  const replies = [], f = { guild: { id: 'guild', members: { fetch: async id => {
    assert.equal(id, user.id); return { user: { tag: 'Target' }, roles: { add: async value => { assigned = value; } } };
  } } }, options: { getSubcommand: () => 'assign', getUser: () => user, getRole: () => role }, reply: async p => replies.push(p) };
  await require('../commands/roles_management').execute(f);
  assert.equal(assigned, role); assert.match(replies[0].content, /Assigned/);
});
test('warn clear actually lifts the timeout and reports a permission failure accurately', async () => {
  const Model = require('../schemas/commissionOffender'), original = Model.findOneAndDelete;
  Model.findOneAndDelete = async () => ({ Strikes: 2 });
  let lifted = false, reply;
  const f = { guild: { id: 'guild', members: { fetch: async () => ({ communicationDisabledUntilTimestamp: Date.now() + 1000, timeout: async value => { assert.equal(value, null); lifted = true; } }) } },
    user: { tag: 'Admin' }, options: { getSubcommand: () => 'clear', getUser: () => ({ id: 'target', username: 'Target' }) }, reply: async p => { reply = p; } };
  try {
    await require('../commands/warn').execute(f); assert.equal(lifted, true); assert.match(reply.content, /timeout was lifted/);
    f.guild.members.fetch = async () => { throw new Error('Missing permissions'); };
    await require('../commands/warn').execute(f); assert.match(reply.content, /could not check or lift/);
  } finally { Model.findOneAndDelete = original; }
});
test('ship mention resolution uses guild nicknames via the real member manager path', async () => {
  const command = require('../commands/ship');
  const result = await command.resolvePersons({ options: { data: [{}], getString: key => key === 'person1' ? '<@123456789012345678>' : '<@223456789012345678>' },
    user: { id: 'me', username: 'Me' }, guild: { members: { fetch: async id => ({ displayName: id.startsWith('1') ? 'Guild Alice' : 'Guild Bob' }) } } });
  assert.deepEqual(result, { person1: 'Guild Alice', person2: 'Guild Bob' });
});
test('profile confirmation is acknowledged before deletion and removes its controls', async () => {
  const Profile = require('../schemas/Profile'), original = Profile.findOneAndDelete;
  let deleted = 0; Profile.findOneAndDelete = async () => { deleted++; };
  const f = fixture('profile', [{ type: 1, name: 'delete' }]);
  try {
    await runCommand(require('../commands/profile'), f.interaction);
    const outsider = f.button('confirm_delete_profile', { id: '900000000000000001', username: 'Outsider', discriminator: '0' });
    f.client.emit('interactionCreate', outsider);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deleted, 0); assert.equal(outsider.replied, true);
    const click = f.button('confirm_delete_profile');
    f.client.emit('interactionCreate', click);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deleted, 1); assert.equal(click.deferred, true);
    assert.equal(f.requests.at(-1).body.content, 'Your profile has been deleted.');
    assert.deepEqual(f.requests.at(-1).body.components, []);
  } finally { Profile.findOneAndDelete = original; f.client.destroy(); }
});
test('leaderboard navigation acknowledges other members and defers before editing the selected page', async () => {
  const f = fixture('leaderboard'), command = require('../commands/leaderboard');
  const rows = Array.from({ length: 15 }, (_, n) => ({ Username: `Moderator ${n}`, Credits: 100 - n }));
  try {
    const message = await f.interaction.reply({ content: 'Leaderboard', components: command.createNavigationButtons(1, 2, 'credits'), fetchReply: true });
    command.setupNavigationCollector(message, rows, 'credits', f.interaction, 'Credits');
    const outsider = f.button('credits_next_1', { id: '900000000000000001', username: 'Outsider', discriminator: '0' });
    f.client.emit('interactionCreate', outsider); await new Promise(resolve => setImmediate(resolve));
    assert.equal(outsider.replied, true);
    const click = f.button('credits_next_1');
    f.client.emit('interactionCreate', click); await new Promise(resolve => setImmediate(resolve));
    assert.equal(click.deferred, true);
    assert.match(f.requests.at(-1).body.embeds[0].footer.text, /Page 2\/2/);
  } finally { f.client.destroy(); }
});
after(() => require('../utilities/client').destroy());
