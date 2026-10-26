const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Collection } = require('discord.js');
const command = require('../commands/tictactoe');
const { reserveSession } = require('../utilities/gameSessions');
class Collector extends EventEmitter {
  stop(reason) { if (!this.stopped) { this.stopped = true; this.emit('end', new Collection(), reason); } }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(kind, other = null) {
  const collectors = [], edits = [], replies = [];
  const player = { id: 'player', username: 'Alice' };
  const message = { edit: async p => { edits.push(p); }, createMessageComponentCollector: options => { const c = new Collector(); c.options = options; collectors.push(c); return c; } };
  const interaction = { guild: { id: `command-${kind}`, members: { fetch: async () => ({}) } }, user: player,
    options: { getSubcommand: () => kind, getUser: () => other }, reply: async payload => { replies.push(payload); return message; } };
  return { collectors, edits, replies, interaction, player };
}
test('solo game rejects spectators and releases its slot when it expires', async () => {
  const f = fixture('guess');
  await command.execute(f.interaction);
  const collector = f.collectors[0]; assert.equal(collector.options.idle, 90_000);
  let reply;
  collector.emit('collect', { customId: 'game:guess', user: { id: 'spectator' }, reply: async p => { reply = p; } });
  await tick(); assert.match(reply.content, /Only/);
  collector.stop('time');
  const release = reserveSession(f.interaction.guild.id, [f.player]); assert.ok(release); release();
  assert.deepEqual(f.edits.at(-1).components, []);
});
test('versus games require consent and enforce the first player turn', async () => {
  const other = { id: 'friend', username: 'Bob', bot: false }, f = fixture('connect-four', other);
  await command.execute(f.interaction);
  assert.equal(f.collectors[0].options.time, 60_000);
  const accept = { customId: 'game:accept', user: other, deferUpdate: async () => {} };
  assert.equal(f.collectors[0].options.filter(accept), true);
  f.collectors[0].emit('end', new Collection([['accept', accept]])); await tick();
  assert.equal(f.collectors.length, 2);
  let reply;
  f.collectors[1].emit('collect', { customId: 'game:0', user: other, reply: async p => { reply = p; } });
  await tick(); assert.match(reply.content, /turn/);
  f.collectors[1].stop('time');
});
test('declined co-op challenges release both players without starting a game', async () => {
  const other = { id: 'friend', username: 'Bob', bot: false }, f = fixture('dungeon', other);
  await command.execute(f.interaction);
  f.collectors[0].emit('end', new Collection([['decline', { customId: 'game:decline' }]])); await tick();
  assert.equal(f.collectors.length, 1); assert.match(f.edits.at(-1).content, /declined/);
  const release = reserveSession(f.interaction.guild.id, [f.player, other]); assert.ok(release); release();
});
after(() => require('../utilities/client').destroy());
