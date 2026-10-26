const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../utilities/guildSettings');
const ImageLinks = require('../schemas/imgLinks');
const preset = require('../presets/kettle.json');
const channelKinds = ['moderation', 'deleted', 'media', 'birthdayVip', 'birthdayStandard', 'restricted', 'status'];
const features = ['commission', 'credits', 'egg', 'birthdays', 'roles'];
module.exports = {
  data: new SlashCommandBuilder().setName('setup').setDescription('Configure this server without affecting any other server.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(s => s.setName('view').setDescription('View this server’s configuration.'))
    .addSubcommand(s => s.setName('channel').setDescription('Set a feature channel; omit channel to disable that destination.')
      .addStringOption(o => o.setName('kind').setDescription('Feature channel.').setRequired(true).addChoices(...channelKinds.map(value => ({ name: value, value }))))
      .addChannelOption(o => o.setName('channel').setDescription('A text or announcement channel in this server.').addChannelTypes(0, 5)))
    .addSubcommand(s => s.setName('toggle').setDescription('Enable or disable an automatic feature in this server.')
      .addStringOption(o => o.setName('feature').setDescription('Feature.').setRequired(true).addChoices(...features.map(value => ({ name: value, value }))))
      .addBooleanOption(o => o.setName('enabled').setDescription('Enabled?').setRequired(true)))
    .addSubcommand(s => s.setName('role').setDescription('Map a subscription/source role to an automatic target role.')
      .addRoleOption(o => o.setName('source').setDescription('Qualifying source role.').setRequired(true))
      .addRoleOption(o => o.setName('target').setDescription('Automatically granted target role.').setRequired(true))
      .addBooleanOption(o => o.setName('remove').setDescription('Remove this rule instead of adding it.')))
    .addSubcommand(s => s.setName('birthday-role').setDescription('Set a role for VIP or subscriber-only birthday eligibility.')
      .addRoleOption(o => o.setName('role').setDescription('Qualifying role.').setRequired(true))
      .addStringOption(o => o.setName('tier').setDescription('VIP channel, or eligibility for the standard channel.').setRequired(true)
        .addChoices({ name: 'VIP', value: 'vipRoles' }, { name: 'Standard eligibility', value: 'eligibleRoles' }))
      .addBooleanOption(o => o.setName('remove').setDescription('Remove this role from birthday rules.')))
    .addSubcommand(s => s.setName('birthday-public').setDescription('Allow all members to receive standard birthday announcements.')
      .addBooleanOption(o => o.setName('enabled').setDescription('Allow everyone?').setRequired(true)))
    .addSubcommand(s => s.setName('integration').setDescription('Configure trusted bot logs for moderator credits.')
      .addStringOption(o => o.setName('service').setDescription('Trusted integration.').setRequired(true)
        .addChoices({ name: 'Carl-bot', value: 'carl' }, { name: 'Ticket transcripts', value: 'tickets' }))
      .addUserOption(o => o.setName('bot').setDescription('The actual bot that sends the embeds.').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Log channel for this integration.').setRequired(true).addChannelTypes(0, 5)))
    .addSubcommand(s => s.setName('banner').setDescription('Set a redeem-code banner for this server.')
      .addStringOption(o => o.setName('game').setDescription('Game.').setRequired(true)
        .addChoices({ name: 'Genshin', value: 'Genshin' }, { name: 'Star Rail', value: 'HSR' }, { name: 'Zenless', value: 'ZZZ' }))
      .addStringOption(o => o.setName('url').setDescription('HTTPS image URL.').setRequired(true).setMaxLength(2048)))
    .addSubcommand(s => s.setName('preset').setDescription('Restore Kettle defaults, only in an original Kettle guild.')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id, options = interaction.options, sub = options.getSubcommand();
    const settings = await getGuildSettings(guildId);
    if (sub === 'view') {
      const lines = ['**Server configuration**', ...Object.entries(settings.features).map(([key, value]) => `${key}: ${value ? 'enabled' : 'disabled'}`),
        ...Object.entries(settings.channels).map(([key, value]) => `${key}: ${value ? `<#${value}>` : 'not set'}`), `Role rules: ${settings.roles.length}`];
      return interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
    }
    const patch = {};
    if (sub === 'channel') {
      const channel = options.getChannel('channel');
      if (channel && channel.guildId !== guildId) return interaction.editReply('Choose a channel from this server.');
      patch[`channels.${options.getString('kind')}`] = channel?.id || '';
    } else if (sub === 'toggle') {
      patch[`features.${options.getString('feature')}`] = options.getBoolean('enabled');
    } else if (sub === 'role') {
      const source = options.getRole('source'), target = options.getRole('target');
      if (source.guild.id !== guildId || target.guild.id !== guildId || source.id === target.id || target.managed || target.id === guildId)
        return interaction.editReply('Choose two different, usable roles from this server.');
      const rules = structuredClone(settings.roles);
      let rule = rules.find(item => [target.id, target.name].includes(item.target));
      if (!rule) { rule = { sources: [], target: target.id }; rules.push(rule); }
      rule.sources = rule.sources.filter(reference => ![source.id, source.name].includes(reference));
      if (!options.getBoolean('remove')) rule.sources.push(source.id);
      patch.roles = rules.filter(item => item.sources.length);
      if (patch.roles.length > 20) return interaction.editReply('A server can have at most 20 automatic target-role rules.');
    } else if (sub === 'birthday-role') {
      const role = options.getRole('role'), tier = options.getString('tier');
      if (role.guild.id !== guildId) return interaction.editReply('Choose a role from this server.');
      const roles = settings.birthday[tier].filter(id => id !== role.id);
      if (!options.getBoolean('remove')) roles.push(role.id);
      patch[`birthday.${tier}`] = roles;
    } else if (sub === 'birthday-public') patch['birthday.allowEveryone'] = options.getBoolean('enabled');
    else if (sub === 'integration') {
      const bot = options.getUser('bot'), channel = options.getChannel('channel'), service = options.getString('service');
      if (!bot.bot || channel.guildId !== guildId) return interaction.editReply('Select a bot account and a channel from this server.');
      patch[`integrations.${service === 'carl' ? 'carlBotId' : 'ticketsBotId'}`] = bot.id;
      patch[service === 'carl' ? 'channels.moderation' : 'integrations.ticketChannelId'] = channel.id;
    } else if (sub === 'banner') {
      const value = options.getString('url');
      try { if (new URL(value).protocol !== 'https:') throw new Error(); }
      catch { return interaction.editReply('Enter a valid HTTPS image URL.'); }
      await ImageLinks.updateOne({ GuildID: guildId }, { $set: { [options.getString('game')]: value }, $setOnInsert: { GuildID: guildId } }, { upsert: true });
      return interaction.editReply('✅ Redeem banner saved for this server.');
    } else if (sub === 'preset') {
      if (!preset.guilds[guildId]) return interaction.editReply('The Kettle preset is restricted to its original guild IDs. Use /setup to choose channels and roles here.');
      Object.assign(patch, preset.guilds[guildId]);
    }
    await updateGuildSettings(guildId, patch);
    return interaction.editReply('✅ Configuration saved for this server. Use /setup view to review it.');
  },
};
