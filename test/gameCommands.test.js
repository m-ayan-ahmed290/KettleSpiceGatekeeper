const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const command = require('../commands/tictactoe');
const runtime = require('../utilities/gameRuntime');
const { reserveSession } = require('../utilities/gameSessions');
const { fixture: discordFixture } = require('./discordFixture');
function fixture(kind, other = null) {
  const edits = [], replies = [], player = { id: 'player', username: 'Alice' };
  const interaction = { guild: { id: `command-${kind}`, members: { fetch: async () => ({}) } }, user: player,
    options: { getSubcommand: () => kind, getUser: () => other },
    reply: async payload => { replies.push(payload); return { id: 'message' }; },
    editReply: async payload => { edits.push(payload); return { id: 'message' }; },
  };
  function click(action, user = player) {
    const source = edits.at(-1) || replies[0];
    const id = source.components[0].components[0].data.custom_id.split(':')[1];
    const calls = [];
    return { customId: `game:${id}:${action}`, guildId: interaction.guild.id, message: { id: 'message' }, user,
      calls, reply: async p => calls.push(['reply', p]), deferUpdate: async () => calls.push(['defer']),
      followUp: async p => calls.push(['followUp', p]),
    };
  }
  return { edits, replies, interaction, player, click };
}
test('solo games acknowledge spectators, reject bad moves and release slots on cancellation', async () => {
  const f = fixture('guess'); await command.execute(f.interaction);
  const spectator = f.click('guess', { id: 'spectator' });
  await runtime.handleGameInteraction(spectator); assert.match(spectator.calls[0][1].content, /Only/);
  const bad = f.click('guess'); bad.values = ['21']; await runtime.handleGameInteraction(bad);
  assert.equal(bad.calls[0][0], 'defer'); assert.match(bad.calls[1][1].content, /1–20/);
  await runtime.handleGameInteraction(f.click('cancel'));
  const release = reserveSession(f.interaction.guild.id, [f.player]); assert.ok(release); release();
  assert.deepEqual(f.edits.at(-1).components, []);
});
test('Connect Four acknowledges host, spectator, invitee, wrong turns, and valid alternating moves', async () => {
  const other = { id: 'friend', username: 'Bob', bot: false }, f = fixture('connect-four', other);
  await command.execute(f.interaction);
  const host = f.click('accept'); await runtime.handleGameInteraction(host); assert.match(host.calls[0][1].content, /Only the invited/);
  const spectator = f.click('accept', { id: 'stranger' }); await runtime.handleGameInteraction(spectator); assert.match(spectator.calls[0][1].content, /Only/);
  const accept = f.click('accept', other); await runtime.handleGameInteraction(accept); assert.equal(accept.calls[0][0], 'defer');
  const wrong = f.click('0', other); await runtime.handleGameInteraction(wrong); assert.match(wrong.calls[0][1].content, /turn/);
  const first = f.click('0'); await runtime.handleGameInteraction(first); assert.equal(first.calls[0][0], 'defer');
  assert.match(f.edits.at(-1).embeds[0].toJSON().description, /Bob's turn/);
  const second = f.click('1', other); await runtime.handleGameInteraction(second);
  assert.match(f.edits.at(-1).embeds[0].toJSON().description, /Alice's turn/);
  await runtime.handleGameInteraction(f.click('cancel'));
});
test('declined co-op challenges release both players and stale buttons receive a reply', async () => {
  const other = { id: 'friend', username: 'Bob', bot: false }, f = fixture('dungeon', other);
  await command.execute(f.interaction);
  const decline = f.click('decline', other); await runtime.handleGameInteraction(decline);
  assert.match(f.edits.at(-1).content, /declined/);
  const release = reserveSession(f.interaction.guild.id, [f.player, other]); assert.ok(release); release();
  await runtime.handleGameInteraction(decline); assert.match(decline.calls.at(-1)[1].content, /expired/);
});
test('send failures and update failures never retain a player reservation', async () => {
  const f = fixture('guess'); f.interaction.reply = async () => { throw new Error('send failed'); };
  await assert.rejects(command.execute(f.interaction), /send failed/);
  const release = reserveSession(f.interaction.guild.id, [f.player]); assert.ok(release); release();
  const next = fixture('guess'); await command.execute(next.interaction);
  next.interaction.editReply = async () => { throw new Error('edit failed'); };
  const click = next.click('guess'); click.values = ['1']; await runtime.handleGameInteraction(click);
  const again = reserveSession(next.interaction.guild.id, [next.player]); assert.ok(again); again();
});
test('/game cancel is scoped to the player and guild and removes pending invitations', async () => {
  const f = fixture('tictactoe', { id: 'friend', username: 'Bob' }); await command.execute(f.interaction);
  await runtime.cancelGame(f.interaction); assert.match(f.replies.at(-1).content, /cancelled/);
  assert.deepEqual(f.edits.at(-1).components, []);
  await runtime.cancelGame(f.interaction); assert.match(f.replies.at(-1).content, /no active game/);
});
test('actual Discord button interactions reach the dispatcher and are acknowledged before the game edit', async () => {
  const f = discordFixture('game', [{ type: 1, name: 'guess' }]);
  try {
    await require('../utilities/runCommand').runCommand(command, f.interaction);
    const first = f.requests.find(r => r.body?.type === 4);
    const cancelId = first.body.data.components.at(-1).components[0].custom_id;
    const click = f.button(cancelId);
    await require('../events/interactionCreate').execute(click);
    assert.equal(click.deferred, true);
    assert.equal(f.requests.at(-2).body.type, 6);
    assert.equal(f.requests.at(-1).method, 'PATCH');
    assert.deepEqual(f.requests.at(-1).body.components, []);
    const release = reserveSession(f.guild.id, [f.user]); assert.ok(release); release();
  } finally { f.client.destroy(); }
});
test('unanswered invitations and idle games expire and free all participants', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const friend = { id: 'friend', username: 'Bob' }, f = fixture('dungeon', friend);
  await command.execute(f.interaction);
  t.mock.timers.tick(60_001);
  await Promise.resolve(); await Promise.resolve();
  assert.match(f.edits.at(-1).content, /Challenge expired/);
  const release = reserveSession(f.interaction.guild.id, [f.player, friend]); assert.ok(release); release();
  const solo = fixture('guess'); await command.execute(solo.interaction);
  t.mock.timers.tick(90_001);
  await Promise.resolve(); await Promise.resolve();
  assert.match(solo.edits.at(-1).content, /Game expired/);
  const again = reserveSession(solo.interaction.guild.id, [solo.player]); assert.ok(again); again();
});
test('simultaneous game clicks are acknowledged without applying a second move', async () => {
  const f = fixture('connect-four', { id: 'friend', username: 'Bob' }); await command.execute(f.interaction);
  await runtime.handleGameInteraction(f.click('accept', { id: 'friend', username: 'Bob' }));
  let allow;
  const first = f.click('0'); first.deferUpdate = () => new Promise(resolve => { allow = resolve; });
  const move = runtime.handleGameInteraction(first);
  const duplicate = f.click('1'); await runtime.handleGameInteraction(duplicate);
  assert.match(duplicate.calls[0][1].content, /previous action/);
  allow(); await move;
  const description = f.edits.at(-1).embeds[0].toJSON().description;
  assert.equal((description.match(/🔴/g) || []).length, 1);
  await runtime.handleGameInteraction(f.click('cancel'));
});
test('a completed Tic Tac Toe match disables controls, saves once, and immediately frees its players', async () => {
  const Stats = require('../schemas/gameStats'), Profile = require('../schemas/Profile');
  const statsUpdate = Stats.updateOne, profileUpdate = Profile.updateOne;
  let saved = 0; Stats.updateOne = async () => { saved++; }; Profile.updateOne = async () => {};
  const f = fixture('tictactoe');
  try {
    await command.execute(f.interaction);
    let lastClick;
    for (let n = 0; n < 9; n++) {
      const view = f.edits.at(-1) || f.replies[0];
      const square = view.components.flatMap(row => row.components).find(b => !b.data.disabled && /:\d$/.test(b.data.custom_id));
      if (!square) break;
      lastClick = f.click(square.data.custom_id.split(':').at(-1));
      await runtime.handleGameInteraction(lastClick);
    }
    assert.equal(saved, 1);
    assert.ok(f.edits.at(-1).components.flatMap(row => row.components).every(b => b.data.disabled));
    const release = reserveSession(f.interaction.guild.id, [f.player]); assert.ok(release); release();
    await runtime.handleGameInteraction(lastClick); assert.equal(saved, 1);
  } finally { Stats.updateOne = statsUpdate; Profile.updateOne = profileUpdate; }
});
after(() => require('../utilities/client').destroy());
