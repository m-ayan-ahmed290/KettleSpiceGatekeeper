/**
 * messageDelete.js — Logs deleted messages with their attachments.
 *
 * ROOT CAUSE OF MISSING ATTACHMENTS:
 * Discord invalidates CDN attachment URLs within seconds of a message being
 * deleted. By the time our messageDelete handler fires and tries to fetch()
 * those URLs, they return 403 or 404. This is why attachments were silently
 * failing to log.
 *
 * FIX:
 * attachmentCache.js downloads every attachment buffer at messageCreate time,
 * before any deletion happens. This handler reads from that cache instead of
 * trying to re-fetch dead URLs. If a message wasn't cached (e.g. the bot was
 * offline when it was sent, or it's a partial), we note that gracefully.
 */

const { MessageEmbed, MessageAttachment } = require("discord.js");
const { log_channel } = require("../data/log-channel.json");
const { listToMatrix } = require("../utilities/listToMatrix");
const { consumeCache } = require("../utilities/attachmentCache");
const client = require("../utilities/client");

const IMAGE_LOG_CHANNEL_ID = "1184557200480403487";
const WEBHOOK_NAME         = "Kettle's Tea Garden Media Logger";
const MAX_EMBED_DESC       = 4000;

module.exports = {
  name: "messageDelete",
  once: false,

  async execute(message) {
    if (!message.guild) return;

    const logChannelId = log_channel[message.guild.id];
    const logChannel   = client.channels.cache.get(logChannelId);
    if (!logChannel) {
      console.warn(`[MessageDelete] No log channel for guild ${message.guild.id}`);
      return;
    }

    // ── Was this message cached? ────────────────────────────────────────────
    const cached = consumeCache(message.id);

    // If there are no attachments in the cache AND the live message has none, exit.
    // (Text-only deletes are covered by the audit log.)
    const liveAttachmentCount = message.attachments?.size ?? 0;
    if (!cached && liveAttachmentCount === 0) return;

    const messageCtx = message.content?.trim() || "*(no text content)*";
    const authorTag  = message.author?.tag  ?? "Unknown User";
    const authorId   = message.author?.id   ?? "unknown";
    const authorAvatar = message.author?.displayAvatarURL({ dynamic: true }) ?? null;

    const imageLogCh = client.channels.cache.get(IMAGE_LOG_CHANNEL_ID) ?? null;

    // ── Build embeds from cached attachments ────────────────────────────────
    const embeds = [];

    if (cached?.attachments?.length) {
      for (const att of cached.attachments) {
        const type = getTypeFromContentType(att.contentType);
        if (!type) continue;

        let uploadedUrl   = null;
        let statusNote    = null;

        if (!att.buffer) {
          // Either too large or download failed at cache time
          statusNote = att.size > 10 * 1024 * 1024
            ? `⚠️ File too large to re-upload (${formatBytes(att.size)}) — original link is now dead.`
            : `⚠️ Could not download attachment before deletion — Discord URL may have expired.`;
        } else {
          // We have the buffer — re-upload it
          try {
            const file       = new MessageAttachment(att.buffer, att.name);
            const target     = imageLogCh ?? logChannel;
            const uploadMsg  = await target.send({
              content: `📦 Saved from deleted message | Author: \`${authorTag}\` | Channel: ${message.channel}`,
              files: [file],
            });
            uploadedUrl = uploadMsg.attachments.first()?.url ?? null;
          } catch (err) {
            console.error(`[MessageDelete] Re-upload failed for "${att.name}":`, err);
            statusNote = `⚠️ Re-upload failed: ${err.message}`;
          }
        }

        embeds.push(buildEmbed({
          type,
          att,
          message,
          messageCtx,
          authorTag,
          authorId,
          authorAvatar,
          uploadedUrl,
          statusNote,
          imageLogCh,
          logChannelId,
        }));
      }
    } else {
      // Message was not in cache (bot was offline, or message is very old)
      // Compose a notice-only embed for text content at minimum
      if (message.partial) {
        // Fully uncached — we know nothing
        const embed = new MessageEmbed()
          .setColor("#888888")
          .setTitle("🗑️ Message Deleted (Uncached)")
          .setDescription(
            `A message was deleted in ${message.channel} but was not in the bot's cache.\n` +
            `No content or attachment data is available.`
          )
          .setFooter({ text: `Message ID: ${message.id}` })
          .setTimestamp();
        embeds.push(embed);
      } else if (liveAttachmentCount > 0) {
        // Message was in Discord's cache but not our attachment cache (e.g. bot just restarted)
        const embed = new MessageEmbed()
          .setColor("#FF8800")
          .setAuthor({ name: authorTag, iconURL: authorAvatar })
          .setTitle("🗑️ Deleted Message — Attachment Lost")
          .setDescription(
            `${message.channel} — **${liveAttachmentCount}** attachment(s) could not be recovered.\n` +
            `**Message Content:** ${messageCtx.slice(0, MAX_EMBED_DESC - 200)}\n\n` +
            `⚠️ The bot was not running when this message was sent, so no buffer was cached.\n` +
            `Discord CDN links have already expired.`
          )
          .setFooter({
            text: `Author ID: ${authorId}`,
            iconURL: message.guild.iconURL({ dynamic: true }),
          })
          .setTimestamp();
        embeds.push(embed);
      }
    }

    if (!embeds.length) return;

    // ── Send via webhook ────────────────────────────────────────────────────
    const chunks = listToMatrix(embeds, 10);
    for (const chunk of chunks) {
      try {
        const webhook = await getOrCreateWebhook(logChannel, WEBHOOK_NAME);
        await webhook.send({ embeds: chunk });
      } catch (err) {
        console.error("[MessageDelete] Webhook send failed, falling back:", err);
        try {
          await logChannel.send({ embeds: chunk });
        } catch (fb) {
          console.error("[MessageDelete] Fallback send also failed:", fb);
        }
      }
    }
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeFromContentType(ct = "") {
  if (ct.startsWith("image")) return "image";
  if (ct.startsWith("video")) return "video";
  if (ct.startsWith("audio")) return "audio";
  if (ct.includes("gif"))     return "image"; // GIFs come through as image/gif
  return null;
}

function buildEmbed({ type, att, message, messageCtx, authorTag, authorId, authorAvatar, uploadedUrl, statusNote, imageLogCh, logChannelId }) {
  const label = type.charAt(0).toUpperCase() + type.slice(1);

  let desc =
    `**${label}** deleted in ${message.channel}\n` +
    `**Message Content:** ${messageCtx.slice(0, 900)}`;

  if (statusNote) {
    desc += `\n\n${statusNote}`;
  } else if (imageLogCh && imageLogCh.id !== logChannelId && uploadedUrl) {
    desc += `\n\n📂 File re-uploaded to ${imageLogCh}.`;
  }

  const embed = new MessageEmbed()
    .setColor(statusNote ? "#FF8800" : "#da0000")
    .setAuthor({ name: authorTag, iconURL: authorAvatar })
    .setDescription(desc)
    .setFooter({
      text: `Author ID: ${authorId} | File: ${att.name}`,
      iconURL: message.guild.iconURL({ dynamic: true }),
    })
    .setTimestamp();

  if (type === "image" && uploadedUrl) embed.setImage(uploadedUrl);

  return embed;
}

async function getOrCreateWebhook(channel, name) {
  const webhooks = await channel.fetchWebhooks();
  let wh = webhooks.find((w) => w.name === name);
  if (!wh) {
    wh = await channel.createWebhook(name, {
      avatar: "https://i.ibb.co/QvSrf3XC/meme-profile-pic.png",
    });
  }
  return wh;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024, u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${u[i]}`;
}
