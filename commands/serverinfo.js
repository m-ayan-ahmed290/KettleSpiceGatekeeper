const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
module.exports = {
  data: new SlashCommandBuilder().setName("serverinfo").setDescription("Show this server's information without fetching all members."),
  async execute(interaction) {
    const guild = interaction.guild;
    const embed = new MessageEmbed().setTitle(guild.name).setColor("BLURPLE")
      .setThumbnail(guild.iconURL({ dynamic: true })).addFields(
        { name: "Members", value: String(guild.memberCount), inline: true },
        { name: "Channels", value: String(guild.channels.cache.size), inline: true },
        { name: "Roles", value: String(guild.roles.cache.size), inline: true },
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Boosts", value: String(guild.premiumSubscriptionCount || 0), inline: true }
      ).setFooter({ text: `Server ID: ${guild.id}` });
    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
