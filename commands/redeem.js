/**
 * redeem.js — Post Genshin / HSR / ZZZ redeem code embeds with clickable buttons.
 *
 * Fixes:
 *  - `interaction.isReplied` → `interaction.replied` (isReplied is not a property)
 *  - URL generator called with full subcommand name; now maps cleanly
 *  - Empty/whitespace-only codes are filtered out
 *  - Description mutation pattern (appending to embed.description) is fragile;
 *    replaced with building the description string before constructing the embed
 */

const { SlashCommandBuilder } = require("discord.js");
const { EmbedBuilder, PermissionsBitField, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const imgLinks = require("../schemas/imgLinks");
const { emojiForGuild } = require("../utilities/emojis");

const GAMES = {
  "genshin-impact": {
    title:   "Genshin Impact Redeem Codes",
    redeemUrl: "https://genshin.hoyoverse.com/en/gift",
    codeUrl:   (code) => `https://genshin.hoyoverse.com/en/gift?code=${encodeURIComponent(code)}`,
    imageKey: "genshin",
  },
  "star-rail": {
    title:   "Honkai: Star Rail Redeem Codes",
    redeemUrl: "https://hsr.hoyoverse.com/gift",
    codeUrl:   (code) => `https://hsr.hoyoverse.com/gift?code=${encodeURIComponent(code)}`,
    imageKey: "hsr",
  },
  "zenless": {
    title:   "Zenless Zone Zero Redeem Codes",
    redeemUrl: "https://zenless.hoyoverse.com/redemption",
    codeUrl:   (code) => `https://zenless.hoyoverse.com/redemption?code=${encodeURIComponent(code)}`,
    imageKey: "zzz",
  },
};

const BULLET_EMOJIS = ["bp1", "bp2", "bp3", "bp4", "bp5"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Post game redeem code embeds with clickable buttons.")
    .addSubcommand((sub) =>
      sub.setName("genshin-impact").setDescription("Redeem codes for Genshin Impact.")
        .addStringOption(codeOption("Genshin Impact"))
        .addBooleanOption(pinOption())
        .addChannelOption(channelOption())
    )
    .addSubcommand((sub) =>
      sub.setName("star-rail").setDescription("Redeem codes for Honkai: Star Rail.")
        .addStringOption(codeOption("Honkai: Star Rail"))
        .addBooleanOption(pinOption())
        .addChannelOption(channelOption())
    )
    .addSubcommand((sub) =>
      sub.setName("zenless").setDescription("Redeem codes for Zenless Zone Zero.")
        .addStringOption(codeOption("Zenless Zone Zero"))
        .addBooleanOption(pinOption())
        .addChannelOption(channelOption())
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),

  async execute(interaction) {
    const subcmd = interaction.options.getSubcommand();
    const game   = GAMES[subcmd];

    // Validate codes input
    const rawCodes = interaction.options.getString("codes");
    const codes    = [...new Set(rawCodes.split(",").map((c) => c.trim()).filter(Boolean))];

    if (codes.length === 0) {
      return interaction.reply({ content: "❌ No valid codes provided.", ephemeral: true });
    }

    if (codes.some(code => !/^[A-Za-z0-9_-]{1,80}$/.test(code))) return interaction.reply({ content: "❌ Codes must be 1–80 letters, digits, underscores or hyphens.", ephemeral: true });

    if (codes.length > 15) {
      return interaction.reply({ content: "❌ Maximum 15 codes at a time.", ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel") ?? interaction.channel;
    const pin     = interaction.options.getBoolean("pin");

    // Fetch image links
    await interaction.deferReply({ ephemeral: true });
    const links = await getImageLinks(interaction.guild.id) || {};

    await interaction.editReply({ content: `${emojiForGuild(interaction.guild.id).loading} Sending...` });

    try {
      // Build description
      const codeLines = codes.map((code, i) => {
        const bp = emojiForGuild(interaction.guild.id)[BULLET_EMOJIS[i % BULLET_EMOJIS.length]];
        return `${bp} \`${code}\` — [Redeem](${game.codeUrl(code)})`;
      });

      const description =
        `${emojiForGuild(interaction.guild.id).bp3} [Official Redeem Page](${game.redeemUrl})\n` +
        `${emojiForGuild(interaction.guild.id).bp5} Codes expire quickly — redeem ASAP!\n\n` +
        codeLines.join("\n");

      const embed = new EmbedBuilder()
        .setTitle(game.title)
        .setColor(0x5865f2)
        .setDescription(description)
        .setImage(links[game.imageKey])
        .setThumbnail(interaction.user.displayAvatarURL({}))
        .setFooter({
          text: interaction.guild.name,
          iconURL: interaction.guild.iconURL({}),
        })
        .setTimestamp();

      // Build button rows (max 5 per row, max 5 rows = 25 buttons, we cap at 15)
      const rows = [];
      for (let i = 0; i < codes.length; i += 3) {
        const batch   = codes.slice(i, i + 3);
        const btnRow  = new ActionRowBuilder().addComponents(
          batch.map((code) =>
            new ButtonBuilder()
              .setLabel(code)
              .setStyle(5)
              .setURL(game.codeUrl(code))
          )
        );
        rows.push(btnRow);
      }

      const sentMsg = await channel.send({ embeds: [embed], components: rows });
      if (pin) {
        try { await sentMsg.pin(); } catch (e) {
          console.warn("[Redeem] Pin failed:", e.message);
        }
      }

      const summary = codes
        .map((c, i) => `${emojiForGuild(interaction.guild.id)[BULLET_EMOJIS[i % BULLET_EMOJIS.length]]} ${c}`)
        .join("\n");

      await interaction.editReply({
        content: `${emojiForGuild(interaction.guild.id).success} Done!\n\n${summary}\n\n${emojiForGuild(interaction.guild.id).bp4} **Channel:** ${channel}`,
      });
    } catch (error) {
      console.error("[Redeem] Error:", error);
      await interaction.editReply({
        content: `❌ Something went wrong: \`${error.message}\``,
      });
    }
  },
};

// ─── Option builders ──────────────────────────────────────────────────────────

function codeOption(game) {
  return (opt) =>
    opt.setName("codes")
      .setDescription(`Comma-separated ${game} redeem codes.`)
      .setRequired(true);
}

function pinOption() {
  return (opt) =>
    opt.setName("pin").setDescription("Pin the message in the channel?").setRequired(true);
}

function channelOption() {
  return (opt) =>
    opt.setName("channel")
      .setDescription("Channel to post in (defaults to current).")
      .addChannelTypes(0)
      .setRequired(false);
}

// ─── DB helper ────────────────────────────────────────────────────────────────

async function getImageLinks(guildId) {
  try {
    const doc = await imgLinks.findOne({ GuildID: guildId });
    if (!doc) return null;
    return { genshin: doc.Genshin, hsr: doc.HSR, zzz: doc.ZZZ };
  } catch (err) {
    console.error("[Redeem] Failed to fetch image links:", err);
    return null;
  }
}
