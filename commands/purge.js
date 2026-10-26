const { SlashCommandBuilder } = require("discord.js");
const { PermissionsBitField } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("purge").setDescription("Delete recent messages, optionally from one person.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .addIntegerOption(o => o.setName("amount").setDescription("Maximum messages to delete (checks the latest 100).").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName("user").setDescription("Only delete this person's messages.")),
  async execute(interaction) {
    const permissions = interaction.channel.permissionsFor(interaction.guild.members.me);
    if (!permissions?.has([PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.ReadMessageHistory]))
      return interaction.reply({ content: "I need Manage Messages and Read Message History here.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger("amount"), user = interaction.options.getUser("user");
    const recent = await interaction.channel.messages.fetch({ limit: 100, cache: false });
    const cutoff = Date.now() - 14 * 86400_000 + 10_000;
    const candidates = recent.filter(m => m.createdTimestamp > cutoff && (!user || m.author.id === user.id));
    const selected = candidates.first(amount);
    if (!selected.length) return interaction.editReply({ content: "No matching messages newer than 14 days in the latest 100 messages." });
    const deleted = await interaction.channel.bulkDelete(selected, true);
    return interaction.editReply({ content: `✅ Deleted ${deleted.size} message(s)${user ? ` from ${user.username}` : ""}. Older messages were skipped.`, allowedMentions: { parse: [] } });
  },
};
