/**
 * messageReactionAdd.js — Removes 🥚/egg reactions from any message.
 *
 * Fixes:
 *  - The `client.on("raw", ...)` listener was declared at module scope,
 *    meaning it registered a new listener every time the file was required,
 *    leading to duplicate handlers. Now registered once inside execute().
 *  - `repCh.send(...)` was not awaited, causing unhandled rejections.
 *  - Error sends now consistently await.
 *
 * Note: This event requires GUILD_MESSAGE_REACTIONS intent, which is already
 * set in utilities/client.js.
 */

const client = require("../utilities/client");

const LOG_CHANNEL_ID = "1105487618189295686";

// Track whether the raw listener has been registered so we only add it once
let rawListenerRegistered = false;

module.exports = {
  name: "messageReactionAdd",
  once: false,

  async execute(reaction, user) {
    await handleReaction(reaction, user);

    // Register the raw-event fallback once (catches reactions on uncached messages)
    if (!rawListenerRegistered) {
      rawListenerRegistered = true;

      client.on("raw", async (packet) => {
        if (packet.t !== "MESSAGE_REACTION_ADD") return;

        const { d: data } = packet;

        let channel;
        try {
          channel = await client.channels.fetch(data.channel_id);
        } catch { return; }

        // If the message is already in cache, the normal event fires — skip
        if (channel.messages.cache.has(data.message_id)) return;

        let message;
        try {
          message = await channel.messages.fetch(data.message_id);
        } catch { return; }

        const reaction = message.reactions.resolve(data.emoji.id ?? data.emoji.name);
        const reactor  = client.users.cache.get(data.user_id);

        if (!reaction || !reactor) return;
        await handleReaction(reaction, reactor);
      });
    }
  },
};

// ─── Core handler ─────────────────────────────────────────────────────────────

async function handleReaction(reaction, user) {
  if (!reaction) return;

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
