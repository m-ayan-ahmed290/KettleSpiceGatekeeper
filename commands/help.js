const { SlashCommandBuilder } = require("discord.js");
const { EmbedBuilder } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("Browse commands available to you."),
  async execute(interaction) {
    const lines = [...interaction.client.commands.values()].filter(command => {
      const required = command.data.toJSON().default_member_permissions;
      return !required || interaction.memberPermissions?.has(BigInt(required));
    }).map(command => {
      const data = command.data.toJSON();
      const sub = data.options?.filter(option => option.type === 1).map(option => option.name);
      return `**/${data.name}**${sub?.length ? ` (${sub.join(", ")})` : ""} — ${data.description}`;
    });
    await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setTitle("Bot Commands")
      .setColor(0x5865f2).setDescription(lines.join("\n").slice(0, 4096))] });
  },
};
