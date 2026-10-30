const { randomBytes } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
const engines = require('./gameEngines');
const { render, titles } = require('./gameViews');
const { reserveSession, reservationError } = require('./gameSessions');
const { recordGame } = require('./gameStats');
const sessions = new Map();
const CHALLENGE_MS = 60_000, IDLE_MS = 90_000, GAME_MS = 5 * 60_000;

function stateFor(kind) {
  if (kind === 'tictactoe') return engines.createTicTacToe();
  if (kind === 'connect-four') return engines.createConnectFour();
  if (kind === 'guess') return engines.createGuess();
  if (kind === 'dungeon') return engines.createDungeon();
  throw new Error('Unknown game');
}
function arm(session) {
  clearTimeout(session.timer);
  const duration = session.phase === 'challenge' ? CHALLENGE_MS : Math.min(IDLE_MS, Math.max(0, session.deadline - Date.now()));
  session.timer = setTimeout(() => {
    const content = session.phase === 'challenge' ? 'Challenge expired. Both players can start a new game.' : 'Game expired after inactivity or five minutes. You can start another game.';
    finish(session, content).catch(error => console.warn('[Game expiry]', error.message));
  }, duration);
  session.timer.unref();
}
function close(session) {
  clearTimeout(session.timer);
  sessions.delete(session.id);
  session.phase = 'closed';
  session.release();
}
async function finish(session, content) {
  close(session); // Always free participants before attempting network I/O.
  await session.interaction.editReply({ content, embeds: [], components: [], allowedMentions: { parse: [] } });
}
function view(session) { return render(session.state, session.players, session.kind === 'tictactoe' && session.players.length === 1, session.id); }
async function startGame(interaction, kind, players) {
  const guildId = interaction.guild.id;
  const release = reserveSession(guildId, players);
  if (!release) return interaction.reply({ content: reservationError(guildId, players), ephemeral: true });
  const session = { id: randomBytes(8).toString('hex'), guildId, players, kind, release, interaction, phase: 'loading', busy: false, state: null, deadline: 0, timer: null };
  sessions.set(session.id, session);
  try {
    const challenged = players.length > 1;
    session.state = stateFor(kind);
    session.phase = challenged ? 'challenge' : 'active';
    session.deadline = Date.now() + GAME_MS;
    arm(session);
    const components = new ActionRowBuilder().addComponents(
      ...[['accept', 'Accept', 3], ['decline', 'Decline', 4], ['cancel', 'Cancel', 2]].map(([action, label, style]) =>
        new ButtonBuilder().setCustomId(`game:${session.id}:${action}`).setLabel(label).setStyle(style)));
    const message = await interaction.reply(challenged ? {
      content: `<@${players[1].id}>, ${players[0].username} invited you to **${titles[kind]}**. Only you can accept. The host can cancel; the invitation expires in 60 seconds.`,
      components: [components], fetchReply: true, allowedMentions: { users: [players[1].id], parse: [] },
    } : { ...view(session), fetchReply: true });
    session.messageId = message.id;
    // If the invitation expired while a slow send was in flight, remove buttons.
    if (!sessions.has(session.id)) await interaction.editReply({ content: 'Game setup expired. Start a new game.', components: [], embeds: [] });
  } catch (error) { close(session); throw error; }
}
async function notice(interaction, content) { return interaction.reply({ content, ephemeral: true }); }
async function saveStats(session) {
  let saved = true;
  for (let n = 0; n < session.players.length; n++) {
    const { state, kind } = session;
    const result = kind === 'dungeon' ? state.winner === 'party' ? 'win' : 'lose'
      : kind === 'guess' ? state.winner === 0 ? 'win' : 'lose' : state.winner == null ? 'draw' : state.winner === n ? 'win' : 'lose';
    if (!await recordGame(session.guildId, session.players[n], kind, result, state.moves)) saved = false;
  }
  if (!saved) await session.interaction.editReply({ content: 'The game finished, but some stats could not be saved.' });
}
async function handleGameInteraction(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const session = sessions.get(id);
  if (!session || session.guildId !== interaction.guildId || (session.messageId && session.messageId !== interaction.message.id))
    return notice(interaction, 'This game has expired or the bot restarted. Start a new game with /game.');
  const player = session.players.findIndex(user => user.id === interaction.user.id);
  if (player < 0) return notice(interaction, 'Only this game’s players can use these controls. Start your own with /game.');
  if (session.busy) return notice(interaction, 'Your previous action is still being processed. Wait a moment.');
  if (session.phase === 'challenge' && action === 'accept' && player !== 1)
    return notice(interaction, 'Only the invited player can accept. You can cancel this invitation instead.');
  if (session.phase === 'challenge' && action === 'decline' && player !== 1)
    return notice(interaction, 'Only the invited player can decline. Use Cancel to withdraw your invitation.');
  if (session.phase === 'active' && action !== 'cancel' && player !== session.state.turn)
    return notice(interaction, 'Wait for your turn.');
  session.busy = true;
  try {
    await interaction.deferUpdate(); // Acknowledge before message updates or database work.
    if (!sessions.has(id)) return;
    if (action === 'cancel') return await finish(session, `${interaction.user.username} ended the game. Both players can start another game.`);
    if (session.phase === 'challenge') {
      if (action === 'decline') return await finish(session, 'Challenge declined. Both players can start another game.');
      if (action !== 'accept') return await interaction.followUp({ content: 'Accept or decline the invitation first.', ephemeral: true });
      session.phase = 'active'; session.deadline = Date.now() + GAME_MS;
    } else {
      try {
        if (session.kind === 'tictactoe') {
          engines.playTicTacToe(session.state, /^\d$/.test(action) ? Number(action) : NaN, player);
          if (session.players.length === 1 && !session.state.over) engines.playTicTacToe(session.state, engines.botSquare(session.state), 1);
        } else if (session.kind === 'connect-four') engines.playConnectFour(session.state, /^\d$/.test(action) ? Number(action) : NaN, player);
        else if (session.kind === 'guess') engines.playGuess(session.state, action === 'guess' ? Number(interaction.values?.[0]) : NaN);
        else engines.playDungeon(session.state, action, player);
      } catch (error) { return await interaction.followUp({ content: error.message, ephemeral: true }); }
    }
    if (session.state.over) close(session); else arm(session);
    await session.interaction.editReply(view(session));
    if (session.state.over) await saveStats(session);
  } catch (error) {
    console.error('[Game interaction]', error.message);
    close(session);
    await session.interaction.editReply({ content: 'This game ended because a response failed. The session has been released; you can start another game.', components: [], embeds: [] }).catch(() => {});
    if (!interaction.deferred && !interaction.replied) await notice(interaction, 'The game could not be updated. Please start a new game.').catch(() => {});
  } finally { session.busy = false; }
}
async function cancelGame(interaction) {
  const session = [...sessions.values()].find(s => s.guildId === interaction.guild.id && s.players.some(p => p.id === interaction.user.id));
  if (!session) return notice(interaction, 'You have no active game or pending challenge in this server.');
  if (session.busy) return notice(interaction, 'A move is being processed. Try cancelling again in a moment.');
  close(session);
  await interaction.reply({ content: 'Your game or challenge has been cancelled. Its players can start a new game.', ephemeral: true });
  await session.interaction.editReply({ content: 'Game cancelled. You can start another game.', components: [], embeds: [] }).catch(() => {});
}
module.exports = { startGame, handleGameInteraction, cancelGame };
