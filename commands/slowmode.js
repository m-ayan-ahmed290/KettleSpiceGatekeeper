const { SlashCommandBuilder } = require("discord.js");
const { PermissionsBitField } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("slowmode").setDescription("Set this channel's message delay; use 0 to disable.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addIntegerOption(o => o.setName("seconds").setDescription("0–21600 seconds between messages.").setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(interaction) {
    const channel = interaction.channel;
    if (typeof channel.setRateLimitPerUser !== "function") return interaction.reply({ content: "Slowmode is not supported in this channel.", ephemeral: true });
    if (!channel.permissionsFor(interaction.guild.members.me)?.has(PermissionsBitField.Flags.ManageChannels))
      return interaction.reply({ content: "I need Manage Channels here.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const seconds = interaction.options.getInteger("seconds");
    await channel.setRateLimitPerUser(seconds, `Slowmode by ${interaction.user.tag}`);
    return interaction.editReply({ content: seconds ? `✅ Slowmode set to ${seconds} second(s).` : "✅ Slowmode disabled." });
  },
};
