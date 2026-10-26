const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("Browse commands available to you."),
  async execute(interaction) {
    const lines = [...interaction.client.commands.values()].filter(command => {
      const required = command.data.toJSON().default_member_permissions;
      if (["manage-mod", "roles-management"].includes(command.data.name) && interaction.user.id !== "648146589814095893") return false;
      return !required || interaction.memberPermissions?.has(BigInt(required));
    }).map(command => {
      const data = command.data.toJSON();
      const sub = data.options?.filter(option => option.type === 1).map(option => option.name);
      return `**/${data.name}**${sub?.length ? ` (${sub.join(", ")})` : ""} — ${data.description}`;
    });
    await interaction.reply({ ephemeral: true, embeds: [new MessageEmbed().setTitle("Bot Commands")
      .setColor("BLURPLE").setDescription(lines.join("\n").slice(0, 4096))] });
  },
};
