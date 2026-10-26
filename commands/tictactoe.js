const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const engines = require('../utilities/gameEngines');
const { reserveSession } = require('../utilities/gameSessions');
const { recordGame } = require('../utilities/gameStats');
const { getGuildSettings } = require('../utilities/guildSettings');
const Stats = require('../schemas/gameStats');
const titles = { tictactoe: 'Tic Tac Toe', 'connect-four': 'Connect Four', guess: 'Number Guess', dungeon: 'Co-op Dungeon' };
const button = (id, label, disabled = false, style = 2) => new ButtonBuilder().setCustomId(`game:${id}`).setLabel(label).setStyle(style).setDisabled(disabled);
module.exports = {
  data: new SlashCommandBuilder().setName('game').setDescription('Solo games, friendly challenges and cooperative adventures.')
    .addSubcommand(s => s.setName('tictactoe').setDescription('Play against the bot, or challenge a server member.')
      .addUserOption(o => o.setName('opponent').setDescription('Omit to play solo against the bot.')))
    .addSubcommand(s => s.setName('connect-four').setDescription('Challenge someone to Connect Four.')
      .addUserOption(o => o.setName('opponent').setDescription('Your opponent.').setRequired(true)))
    .addSubcommand(s => s.setName('guess').setDescription('Find a secret number in five guesses.'))
    .addSubcommand(s => s.setName('rps').setDescription('Play rock, paper, scissors against the bot.')
      .addStringOption(o => o.setName('choice').setDescription('Your move.').setRequired(true).addChoices(...['rock','paper','scissors'].map(value => ({ name: value, value })))))
    .addSubcommand(s => s.setName('dungeon').setDescription('Team up with a friend to defeat a boss. Share health and potions.')
      .addUserOption(o => o.setName('partner').setDescription('Your teammate.').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('View game statistics in this server.')
      .addUserOption(o => o.setName('user').setDescription('The player to look up.'))),
  async execute(interaction) {
    const kind = interaction.options.getSubcommand();
    if (kind === 'stats') {
      const user = interaction.options.getUser('user') || interaction.user;
      const rows = await Stats.find({ GuildID: interaction.guild.id, UserID: user.id }).sort({ Points: -1 }).limit(5).lean();
      return interaction.reply({ content: rows.length ? rows.map(row => `**${row.Game}** — ${row.Won} wins / ${row.Lost} losses / ${row.Drawn} draws · ${row.Points} arcade points`).join('\n') : 'No arcade games recorded for this player in this server yet. Existing Tic Tac Toe profile history remains available in /profile view.', ephemeral: true });
    }
    if (kind === 'rps') {
      const choice = interaction.options.getString('choice'), outcome = engines.rockPaperScissors(choice);
      const saved = await recordGame(interaction.guild.id, interaction.user, 'rps', outcome.result);
      return interaction.reply({ content: `You chose **${choice}**. I chose **${outcome.opponent}**. **${outcome.result === 'draw' ? 'Draw!' : outcome.result === 'win' ? 'You win!' : 'I win!'}**${saved ? '' : '\nStats could not be saved.'}` });
    }
    const other = kind === 'dungeon' ? interaction.options.getUser('partner') : ['tictactoe','connect-four'].includes(kind) ? interaction.options.getUser('opponent') : null;
    const settings = await getGuildSettings(interaction.guild.id);
    if (other && (other.bot || other.id === interaction.user.id || settings.blockedGameUsers.includes(other.id)))
      return interaction.reply({ content: 'Choose a different eligible human player.', ephemeral: true });
    if (other && !await interaction.guild.members.fetch(other.id).catch(() => null))
      return interaction.reply({ content: 'Choose a member of this server.', ephemeral: true });
    const humans = [interaction.user, ...(other ? [other] : [])];
    const release = reserveSession(interaction.guild.id, humans);
    if (!release) return interaction.reply({ content: 'A player is already in a game here, or all 20 game slots are busy.', ephemeral: true });
    try {
      const message = await interaction.reply({ content: other ? `${other}, ${interaction.user} invited you to **${titles[kind]}**. Accept within 60 seconds.` : `Starting **${titles[kind]}**…`,
        components: other ? [new ActionRowBuilder().addComponents(button('accept', 'Accept', false, 3), button('decline', 'Decline', false, 4))] : [], fetchReply: true });
      if (!other) return launchGame(message, interaction, kind, humans, release);
      const collector = message.createMessageComponentCollector({ time: 60_000, max: 1,
        filter: i => i.user.id === other.id && ['game:accept','game:decline'].includes(i.customId) });
      collector.on('collect', i => i.deferUpdate().catch(() => {}));
      collector.on('end', collected => {
        const accepted = collected.first()?.customId === 'game:accept';
        if (!accepted) {
          release(); message.edit({ content: collected.size ? 'Challenge declined.' : 'Challenge expired.', components: [] }).catch(() => {}); return;
        }
        launchGame(message, interaction, kind, humans, release).catch(error => { release(); console.error('[Game start]', error.message); });
      });
    } catch (error) { release(); throw error; }
  },
};
function stateFor(kind) {
  return kind === 'tictactoe' ? engines.createTicTacToe() : kind === 'connect-four' ? engines.createConnectFour() : kind === 'guess' ? engines.createGuess() : engines.createDungeon();
}
function render(state, players, soloBot) {
  let board = '', components = [];
  if (state.kind === 'tictactoe') {
    for (let row = 0; row < 3; row++) components.push(new ActionRowBuilder().addComponents(Array.from({ length: 3 }, (_, col) => {
      const index = row * 3 + col;
      return button(String(index), state.board[index] == null ? '⬜' : state.board[index] === 0 ? '❌' : '⭕', state.over || state.board[index] != null);
    })));
  } else if (state.kind === 'connect-four') {
    board = state.board.map(row => row.map(cell => cell == null ? '⚪' : cell === 0 ? '🔴' : '🟡').join('')).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
    const buttons = Array.from({ length: 7 }, (_, col) => button(String(col), String(col + 1), state.over || state.board[0][col] != null));
    components = [new ActionRowBuilder().addComponents(buttons.slice(0, 4)), new ActionRowBuilder().addComponents(buttons.slice(4))];
  } else if (state.kind === 'guess') {
    components = [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('game:guess').setPlaceholder('Choose a number from 1 to 20').setDisabled(state.over)
      .addOptions(Array.from({ length: 20 }, (_, n) => ({ label: String(n + 1), value: String(n + 1) }))))];
    board = state.note;
  } else {
    board = `Party HP: **${state.hp}/24** · Boss HP: **${state.boss}/40**\nPotions: **${state.potions}** · Guard: **${state.shield}** · Round: **${Math.min(12, state.round)}/12**\n${state.note}`;
    components = [new ActionRowBuilder().addComponents(button('attack', 'Attack', state.over, 4), button('guard', 'Guard', state.over, 1), button('heal', 'Heal', state.over || !state.potions || state.hp === 24, 3))];
  }
  const names = players.map(user => user.username).concat(soloBot ? ['Bot'] : []);
  let status;
  if (state.over) status = state.kind === 'dungeon' ? state.winner === 'party' ? '🎉 Team victory!' : 'The adventure is over.'
    : state.kind === 'guess' ? state.winner === 0 ? '🎉 You found it!' : 'Game over.' : state.winner == null ? '🤝 Draw!' : `🎉 ${names[state.winner]} wins!`;
  else status = `${names[state.turn]}'s turn`;
  const embed = new EmbedBuilder().setTitle(titles[state.kind]).setColor(0x5865f2).setDescription([names.join(' + '), board, status].filter(Boolean).join('\n\n'));
  return { content: '', embeds: [embed], components };
}
async function launchGame(message, interaction, kind, humans, release) {
  const state = stateFor(kind), soloBot = kind === 'tictactoe' && humans.length === 1;
  let busy = false;
  try { await message.edit(render(state, humans, soloBot)); } catch (error) { release(); throw error; }
  const collector = message.createMessageComponentCollector({ time: 5 * 60_000, idle: 90_000, filter: i => i.customId.startsWith('game:') });
  collector.on('collect', i => {
    (async () => {
      const player = humans.findIndex(user => user.id === i.user.id);
      if (player < 0) return i.reply({ content: 'Only this game’s players can make moves.', ephemeral: true });
      if (busy || state.over) return i.deferUpdate();
      if (player !== state.turn) return i.reply({ content: 'Wait for your turn.', ephemeral: true });
      busy = true;
      try {
        await i.deferUpdate();
        const action = i.customId.slice(5);
        try {
          if (kind === 'tictactoe') {
            engines.playTicTacToe(state, Number(action), player);
            if (soloBot && !state.over) engines.playTicTacToe(state, engines.botSquare(state), 1);
          } else if (kind === 'connect-four') engines.playConnectFour(state, Number(action), player);
          else if (kind === 'guess') engines.playGuess(state, Number(i.values?.[0]));
          else engines.playDungeon(state, action, player);
        } catch (error) { await i.followUp({ content: error.message, ephemeral: true }); return; }
        if (state.over) { collector.stop('finished'); release(); }
        await message.edit(render(state, humans, soloBot));
        if (state.over) {
          let saved = true;
          for (let n = 0; n < humans.length; n++) {
            const result = kind === 'dungeon' ? state.winner === 'party' ? 'win' : 'lose'
              : kind === 'guess' ? state.winner === 0 ? 'win' : 'lose' : state.winner == null ? 'draw' : state.winner === n ? 'win' : 'lose';
            if (!await recordGame(interaction.guild.id, humans[n], kind, result, state.moves)) saved = false;
          }
          if (!saved) await message.edit({ content: 'The game finished, but some stats could not be saved.' });
        }
      } finally { busy = false; }
    })().catch(error => {
      console.error('[Game move]', error.message); state.over = true; collector.stop('error'); release();
      message.edit({ content: 'This game ended because the message could not be updated.', components: [] }).catch(() => {});
    });
  });
  collector.on('end', (_, reason) => {
    release();
    if (reason !== 'finished') { state.over = true; message.edit({ content: reason === 'error' ? 'Game ended.' : 'Game expired after inactivity or five minutes.', components: [] }).catch(() => {}); }
  });
}
module.exports.render = render;
