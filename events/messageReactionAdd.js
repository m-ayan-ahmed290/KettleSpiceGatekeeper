/** Remove egg reactions, including uncached messages via Discord partials. */

const client = require("../utilities/client");

const LOG_CHANNEL_ID = "1105487618189295686";

module.exports = {
  name: "messageReactionAdd",
  once: false,

  async execute(reaction, user) {
    await handleReaction(reaction, user);
  },
};

// ─── Core handler ─────────────────────────────────────────────────────────────

async function handleReaction(reaction, user) {
  if (!reaction || !user) return;
  if (reaction.partial) await reaction.fetch();

  const emojiName = reaction.emoji.name?.toLowerCase() ?? "";
  if (emojiName !== "🥚" && !emojiName.includes("egg")) return;

  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

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
