/**
 * warn.js — Manage commission-spam offender records.
 *
 * Subcommands:
 *   /warn view   <user>  — Show strike history for a user
 *   /warn clear  <user>  — Clear all strikes (and lift timeout if active)
 *   /warn list           — List the top offenders in this server
 */

const { SlashCommandBuilder } = require("discord.js");
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const CommissionOffender = require("../schemas/commissionOffender");


module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Manage commission-spam offender records.")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View strike history for a user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The user to look up.").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Clear all strikes for a user and lift their timeout.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The user to clear.").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List top commission-spam offenders in this server.")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === "view")  return await handleView(interaction);
      if (sub === "clear") return await handleClear(interaction);
      if (sub === "list")  return await handleList(interaction);
    } catch (err) {
      console.error(`[Warn/${sub}] Error:`, err);
      const msg = { content: "⚠️ An error occurred. Check the console.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  },
};

// ─── Subcommand handlers ──────────────────────────────────────────────────────

async function handleView(interaction) {
  const user     = interaction.options.getUser("user");
  const offender = await CommissionOffender.findOne({
    UserID:  user.id,
    GuildID: interaction.guild.id,
  });

  if (!offender) {
    return interaction.reply({
      content: `✅ **${user.username}** has no commission-spam strikes on record.`,
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor("#FF6600")
    .setTitle(`🚨 Commission Spam Record — ${user.username}`)
    .setThumbnail(user.displayAvatarURL({}))
    .addFields(
      { name: "⚡ Total Strikes", value: `${offender.Strikes}`,                              inline: true },
      { name: "🕐 Last Strike",  value: formatDate(offender.LastStrike),                    inline: true },
      { name: "⏰ Timed Out At", value: offender.TimedOutAt ? formatDate(offender.TimedOutAt) : "N/A", inline: true },
    )
    .setFooter({ text: `User ID: ${user.id}` })
    .setTimestamp();

  if (offender.Notes) {
    embed.addFields({ name: "📝 Notes", value: offender.Notes });
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleClear(interaction) {
  const user = interaction.options.getUser("user");

  const deleted = await CommissionOffender.findOneAndDelete({
    UserID:  user.id,
    GuildID: interaction.guild.id,
  });

  if (!deleted) {
    return interaction.reply({
      content: `ℹ️ **${user.username}** has no strike record to clear.`,
      ephemeral: true,
    });
  }

  // Try to lift any active timeout
  try {
    const member = await interaction.guild.members.members.fetch(user.id);
    if (member.communicationDisabledUntilTimestamp) {
      await member.timeout(null, `Timeout lifted by ${interaction.user.tag} via /warn clear`);
    }
  } catch {
    // Member may have left — not a fatal error
  }

  return interaction.reply({
    content:
      `✅ Cleared **${deleted.Strikes}** strike(s) for **${user.username}** and lifted any active timeout.`,
    ephemeral: true,
  });
}

async function handleList(interaction) {
  const offenders = await CommissionOffender.find({ GuildID: interaction.guild.id })
    .sort({ Strikes: -1 })
    .limit(15)
    .lean();

  if (!offenders.length) {
    return interaction.reply({
      content: "✅ No commission-spam offenders recorded for this server.",
      ephemeral: true,
    });
  }

  const lines = offenders.map(
    (o, i) =>
      `\`${i + 1}.\` **${o.Username}** — ${o.Strikes} strike(s) | Last: ${formatDate(o.LastStrike)}`
  );

  const embed = new EmbedBuilder()
    .setColor("#FF6600")
    .setTitle("🚨 Commission Spam Offenders")
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${offenders.length} offenders listed` })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toUTCString().replace(" GMT", " UTC");
}
