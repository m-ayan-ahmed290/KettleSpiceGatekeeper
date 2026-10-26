/**
 * check-credits.js — View credit balance and recent moderation actions.
 */

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const creditSchema = require("../schemas/credits");
const { emoji } = require("../data/emojis.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("credits")
    .setDescription("Check credits for yourself or a moderator.")
    .addUserOption((opt) =>
      opt
        .setName("moderator")
        .setDescription("The moderator to look up (defaults to you).")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_MESSAGES),

  async execute(interaction) {
    const user = interaction.options.getUser("moderator") ?? interaction.user;

    try {
      const creditUser = await creditSchema.findOne({ UserID: user.id }).slice("Action", -5).lean();

      if (!creditUser) {
        return interaction.reply({
          content:
            `${emoji.failure} **${user.username}** has no credit record yet.\n` +
            `Credits are earned through bans, warnings, kicks, timeouts, and closed tickets.`,
          ephemeral: true,
        });
      }

      const embed = new MessageEmbed()
        .setColor(creditUser.Blocked ? "#FF0000" : "#00ff00")
        .setTitle(`Moderator Credits — ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields({
          name: "💰 Credits",
          value: `${emoji.credits} **${creditUser.Credits.toLocaleString()}**`,
          inline: true,
        })
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      if (creditUser.Blocked) {
        embed.addFields(
          { name: "🚫 Blocked", value: "Yes", inline: true },
          { name: "📝 Reason",  value: (creditUser.Reason || "No reason given").slice(0, 1024), inline: true }
        );
      }

      // Show 5 most recent actions, newest first
      const recent = [...creditUser.Action].reverse().slice(0, 5);
      if (recent.length > 0) {
        const lines = recent.map((a, i) => {
          const date = new Date(a.Date).toISOString().split("T")[0];
          return `\`${i + 1}.\` **${date}** — ${a.ActionReason} *(${a.Credit})*`;
        });
        embed.addFields({
          name: "📋 Recent Actions",
          value: lines.join("\n").slice(0, 1024),
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("[Credits] Error:", error);

      const errMsg = {
        content: `${emoji.failure} Error fetching credits data.`,
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    }
  },
};
