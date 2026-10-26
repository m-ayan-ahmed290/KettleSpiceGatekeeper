const { SlashCommandBuilder } = require("@discordjs/builders");
const { Permissions } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("slowmode").setDescription("Set this channel's message delay; use 0 to disable.")
    .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_CHANNELS)
    .addIntegerOption(o => o.setName("seconds").setDescription("0–21600 seconds between messages.").setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(interaction) {
    const channel = interaction.channel;
    if (typeof channel.setRateLimitPerUser !== "function") return interaction.reply({ content: "Slowmode is not supported in this channel.", ephemeral: true });
    if (!channel.permissionsFor(interaction.guild.me)?.has(Permissions.FLAGS.MANAGE_CHANNELS))
      return interaction.reply({ content: "I need Manage Channels here.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const seconds = interaction.options.getInteger("seconds");
    await channel.setRateLimitPerUser(seconds, `Slowmode by ${interaction.user.tag}`);
    return interaction.editReply({ content: seconds ? `✅ Slowmode set to ${seconds} second(s).` : "✅ Slowmode disabled." });
  },
};
