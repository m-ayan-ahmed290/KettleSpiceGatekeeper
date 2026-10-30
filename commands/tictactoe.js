const { SlashCommandBuilder } = require('discord.js');
const engines = require('../utilities/gameEngines');
const { recordGame } = require('../utilities/gameStats');
const { getGuildSettings } = require('../utilities/guildSettings');
const Stats = require('../schemas/gameStats');
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
    .addSubcommand(s => s.setName('cancel').setDescription('End your active game or pending challenge in this server.'))
    .addSubcommand(s => s.setName('stats').setDescription('View game statistics in this server.')
      .addUserOption(o => o.setName('user').setDescription('The player to look up.'))),
  async execute(interaction) {
    const kind = interaction.options.getSubcommand();
    const runtime = require('../utilities/gameRuntime');
    if (kind === 'cancel') return runtime.cancelGame(interaction);
    if (kind === 'stats') {
      const user = interaction.options.getUser('user') || interaction.user;
      const rows = await Stats.find({ GuildID: interaction.guild.id, UserID: user.id }).sort({ Points: -1 }).limit(5).lean();
      return interaction.reply({ content: rows.length ? rows.map(row => `**${row.Game}** — ${row.Won} wins / ${row.Lost} losses / ${row.Drawn} draws · ${row.Points} arcade points`).join('\n') : 'No arcade games recorded for this player in this server yet. Existing Tic Tac Toe profile history remains available in /profile view.', ephemeral: true });
    }
    const settings = await getGuildSettings(interaction.guild.id);
    if (settings.blockedGameUsers.includes(interaction.user.id))
      return interaction.reply({ content: 'Games are disabled for your account in this server.', ephemeral: true });
    if (kind === 'rps') {
      const choice = interaction.options.getString('choice'), outcome = engines.rockPaperScissors(choice);
      await interaction.reply({ content: `You chose **${choice}**. I chose **${outcome.opponent}**. **${outcome.result === 'draw' ? 'Draw!' : outcome.result === 'win' ? 'You win!' : 'I win!'}**` });
      if (!await recordGame(interaction.guild.id, interaction.user, 'rps', outcome.result))
        await interaction.followUp({ content: 'The round finished, but its stats could not be saved.', ephemeral: true });
      return;
    }
    const other = kind === 'dungeon' ? interaction.options.getUser('partner') : ['tictactoe','connect-four'].includes(kind) ? interaction.options.getUser('opponent') : null;
    if (other && (other.bot || other.id === interaction.user.id || settings.blockedGameUsers.includes(other.id)))
      return interaction.reply({ content: 'Choose a different eligible human player.', ephemeral: true });
    if (other && !await interaction.guild.members.fetch(other.id).catch(() => null))
      return interaction.reply({ content: 'Choose a member of this server.', ephemeral: true });
    return runtime.startGame(interaction, kind, [interaction.user, ...(other ? [other] : [])]);
  },
};
module.exports.render = require('../utilities/gameViews').render;
