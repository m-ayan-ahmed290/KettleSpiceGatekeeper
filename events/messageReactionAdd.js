/** Remove egg reactions, including uncached messages via Discord partials. */

const client = require("../utilities/client");

const { getGuildSettings, guildChannel } = require("../utilities/guildSettings");

module.exports = {
  name: "messageReactionAdd",
  once: false,

  async execute(reaction, user) {
    await handleReaction(reaction, user);
  },
};

// ─── Core handler ─────────────────────────────────────────────────────────────

async function handleReaction(reaction, user) {
  if (!reaction || !user || !reaction.message.guild) return;
  const settings = await getGuildSettings(reaction.message.guild.id);
  if (!settings.features.egg) return;
  if (reaction.partial) await reaction.fetch();

  const emojiName = reaction.emoji.name?.toLowerCase() ?? "";
  if (emojiName !== "🥚" && !emojiName.includes("egg")) return;

  const logChannel = await guildChannel(reaction.message.guild, settings.channels.status || settings.channels.moderation);

  try {
    await reaction.users.remove(user.id);
    if (logChannel) {
      await logChannel.send(`🥚 Removed ${reaction.emoji} reaction from **${user.username}**.`);
    }
  } catch (error) {
    console.error("[ReactionAdd] Error removing egg reaction:", error);
    if (logChannel) {
      await logChannel.send(
        `⚠️ Failed to remove egg reaction from **${user.username}**:\n\`\`\`js\n${error}\`\`\``
      ).catch(() => {});
    }
  }
}
