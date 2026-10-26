/**
 * messageCreate.js
 *
 * Responsibilities:
 *  1. Pre-cache attachments so messageDelete can re-upload them before
 *     Discord invalidates CDN URLs (the primary reason attachments fail to log).
 *  2. Detect and action commission / art-spam from hacked or scam accounts.
 *  3. Auto-credit moderators by parsing Carl-bot mod-log embeds (ban/warn/kick/
 *     mute) posted in the mod-log channel, and Tickets-v2 "Ticket Closed"
 *     transcript embeds posted in the ticket-transcript channel.
 *     (Timeouts are still credited via the audit log — see events/auditLog.js.)
 */

const { EmbedBuilder } = require("discord.js");
const { getGuildSettings, guildChannel } = require("../utilities/guildSettings");
const client = require("../utilities/client");
const { cacheMessageAttachments } = require("../utilities/attachmentCache");
const { awardCredits } = require("../utilities/awardCredits");
const { containsBlockedWord } = require("../utilities/blockedWords");
const CommissionOffender = require("../schemas/commissionOffender");

// ─── Commission-spam detection config ─────────────────────────────────────────

/** Leave empty to monitor ALL channels, or add channel ID strings to restrict. */
const MONITORED_CHANNEL_IDS = new Set([]);
const cleanupJobs = new Set();

/** Role IDs exempt from the filter (mods, trusted artists, etc.). */
const EXEMPT_ROLE_IDS = new Set([]);

const PRIMARY_KEYWORDS = ["commission", "comms", "comm", "logo", "live2d"];
const PRIMARY_PATTERNS = Object.fromEntries(PRIMARY_KEYWORDS.map(kw => [kw, new RegExp(`\\b${kw}(?:s)?\\b`, "i")]));
const SECONDARY_KEYWORDS = [
  "pricing",
  "price",
  "dm",
  "dms",
  "message me",
  "msg me",
  "info",
  "custom",
  "open",
  "slots",
  "available",
  "inquire",
  "contact",
  "hire",
  "booking",
  "book me",
  "buy",
  "stream",
  "commissions",
  "open for",
  "similar package",
];
const MIN_SECONDARY_MATCHES = 2;
const TIMEOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Auto-credit config ────────────────────────────────────────────────────────

/**
 * Carl-bot mod-log action → credit amount. The key is matched against a
 * whole word in the embed title (case-insensitive), e.g. "ban | case 1060".
 *
 * "timeout" is intentionally NOT in this map — timeouts stay on the
 * audit-log path in events/auditLog.js. Anything else Carl-bot logs that
 * isn't listed here (e.g. "mute") is skipped with a console notice rather
 * than guessed at, since no credit value was specified for it.
 */
const CARLBOT_ACTION_CREDITS = {
  ban: { label: "Ban", credits: 10 },
  warn: { label: "Warn", credits: 7 },
  kick: { label: "Kick", credits: 8 },
};

/** Credits awarded to whoever closes a ticket. */
const TICKET_CLOSE_CREDITS = 8;

// ─── Event ────────────────────────────────────────────────────────────────────

module.exports = {
  name: "messageCreate",
  once: false,

  async execute(message) {
    if (!message.guild || !message.author) return;
    const settings = await getGuildSettings(message.guild.id);
    const { restricted: restrictedChId, moderation: modChId } = settings.channels;
    const { carlBotId, ticketsBotId, ticketChannelId: ticketChId } = settings.integrations;
    if (message.author.bot) {
      if (!settings.features.credits || !client.dataReady) return;
      try {
        if (
          message.channel.id === modChId &&
          message.author.id === carlBotId &&
          message.embeds.length > 0
        ) {
          await handleCarlBotModLog(message);
        } else if (
          message.channel.id === ticketChId &&
          message.author.id === ticketsBotId &&
          message.embeds.length > 0
        ) {
          await handleTicketClose(message);
        }
      } catch (err) {
        console.error("[MessageCreate] Auto-credit handler error:", err);
      }
      return;
    }

    if (!message.guild) return;

    // Get mod channel early for alerts
    const modChannel = await guildChannel(message.guild, modChId);

    // 1. Cache media only for guilds with a configured deletion log
    if (message.attachments.size > 0 && settings.channels.deleted) {
      cacheMessageAttachments(message).catch((err) =>
        console.error("[MessageCreate] Attachment pre-cache error:", err),
      );
    }

    // 2. Commission filter — only for the configured guild

    if (
      MONITORED_CHANNEL_IDS.size > 0 &&
      !MONITORED_CHANNEL_IDS.has(message.channel.id)
    )
      return;

    const lower = message.content.toLowerCase();
    const isSpam = settings.features.commission && isCommissionSpam(lower);
    if (message.channel.id !== restrictedChId && await containsBlockedWord(lower, message.guild.id)) {
      await message.delete().catch(error => console.warn("[BlockWords]", error.message));
      return;
    }
    if (!isSpam && message.channel.id !== restrictedChId) return;
    let member;
    try {
      member = message.member ?? await message.guild.members.fetch(message.author.id);
    } catch {
      return;
    }

    if (member.roles.cache.some((r) => EXEMPT_ROLE_IDS.has(r.id))) return;

    // ─── Restricted channel check (independent of spam detection) ───────────
    if (message.channel.id === restrictedChId) {
      const cleanupKey = `${message.guild.id}:${message.author.id}`;
      let acquired = false;
      try {
        await message.delete();
        await member.timeout(TIMEOUT_DURATION_MS, "Auto: posted in restricted channel");
        if (cleanupJobs.has(cleanupKey) || cleanupJobs.size >= 2) return;
        cleanupJobs.add(cleanupKey);
        acquired = true;

        // Delete all messages from this user in the past hour across all channels
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        try {
          const textChannels = message.guild.channels.cache.filter(
            (ch) => ch.type === 0 && ch.viewable,
          );

          // Process channels sequentially to bound requests and memory
          const results = [];
          for (const channel of textChannels.values()) {
            results.push(await (async () => {
              try {
                const recentMessages = await channel.messages.fetch({
                  limit: 100,
                });

                const messagesToDelete = recentMessages.filter(
                  (msg) =>
                    msg.author.id === message.author.id &&
                    msg.createdTimestamp > oneHourAgo,
                );

                if (messagesToDelete.size > 0) {
                  await channel.bulkDelete(messagesToDelete, true);
                  return messagesToDelete.size;
                }
                return 0;
              } catch (chErr) {
                return 0;
              }
            })());
          }

          const totalDeleted = results.reduce((a, b) => a + b, 0);
          console.log(
            `[RestrictedChannel] Deleted ${totalDeleted} messages from ${message.author.tag} across all channels`,
          );
        } catch (bulkErr) {
          console.error(
            "[RestrictedChannel] Failed to delete old messages:",
            bulkErr,
          );
        }

        const embed = new EmbedBuilder()
          .setColor("#FF6600")
          .setTitle("Message sent in restricted channel")
          .setAuthor({
            name: `${member.user.tag} (${member.user.id})`,
            iconURL: member.user.displayAvatarURL({}),
          })
          .addFields(
            { name: "Channel", value: `${message.channel}`, inline: true },
            {
              name: "Message Content",
              value:
                message.content.length > 1000
                  ? message.content.slice(0, 997) + "..."
                  : message.content || "*(empty)*",
            },
          )
          .setFooter({
            text: "User timed out 24 h — mods can lift it anytime.",
            iconURL: message.guild.iconURL({}),
          })
          .setTimestamp();
        if (modChannel) await modChannel.send({ embeds: [embed] });
      } catch (error) {
        console.log(
          `Unable to timeout user <@${message.author.id}> (${message.author.username}). Error: ${error}`,
        );
      }
      finally { if (acquired) cleanupJobs.delete(cleanupKey); }
      return; // Stop here - don't process further
    }

    // ─── Commission spam check ──────────────────────────────────────────────
    if (!isSpam) return;

    // Detected — delete first
    try {
      await message.delete();
    } catch (err) {
      console.error("[CommissionFilter] Failed to delete message:", err);
    }

    // Record strike in DB
    let offender;
    try {
      offender = await CommissionOffender.findOneAndUpdate(
        { UserID: message.author.id, GuildID: message.guild.id },
        {
          $inc: { Strikes: 1 },
          $set: {
            Username: message.author.tag,
            LastStrike: new Date(),
            TimedOutAt: new Date(),
          },
          $setOnInsert: {
            UserID: message.author.id,
            GuildID: message.guild.id,
          },
        },
        { upsert: true, new: true },
      );
    } catch (err) {
      console.error("[CommissionFilter] DB error:", err);
      offender = { Strikes: 1 };
    }

    // Apply 24-hour timeout
    try {
      await member.timeout(
        TIMEOUT_DURATION_MS,
        "Auto: commission/art spam detected",
      );
      console.log(
        `[CommissionFilter] Timed out ${message.author.tag} — strike #${offender.Strikes}`,
      );
    } catch (err) {
      console.error("[CommissionFilter] Failed to timeout member:", err);
    }

    // Alert mod channel
    if (!modChannel) return;

    try {
      const embed = new EmbedBuilder()
        .setColor("#FF6600")
        .setTitle("🚨 Commission Spam Detected")
        .setAuthor({
          name: `${member.user.tag} (${member.user.id})`,
          iconURL: member.user.displayAvatarURL({}),
        })
        .addFields(
          { name: "Channel", value: `${message.channel}`, inline: true },
          { name: "Strike #", value: `${offender.Strikes}`, inline: true },
          {
            name: "Message Content",
            value:
              message.content.length > 1000
                ? message.content.slice(0, 997) + "..."
                : message.content || "*(empty)*",
          },
        )
        .setFooter({
          text: "User timed out 24 h — mods can lift it anytime.",
          iconURL: message.guild.iconURL({}),
        })
        .setTimestamp();
      if (modChannel) await modChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("[CommissionFilter] Failed to send mod alert:", err);
    }
  },
};

function isCommissionSpam(text) {
  if (!PRIMARY_KEYWORDS.some((kw) => PRIMARY_PATTERNS[kw].test(text))) return false;
  return (
    SECONDARY_KEYWORDS.filter((kw) => text.includes(kw)).length >=
    MIN_SECONDARY_MATCHES
  );
}

// ─── Carl-bot mod-log auto-credit ──────────────────────────────────────────────

/**
 * Parses a Carl-bot mod-log embed title like "ban | case 1060" into
 * { action: "ban", caseNum: "1060" }. Returns null if no recognized
 * action keyword is found in the title at all.
 */
function parseCarlBotTitle(title) {
  if (!title) return null;
  const actionMatch = title.match(/\b(ban|warn|kick|mute|timeout)\b/i);
  if (!actionMatch) return null;
  const caseMatch = title.match(/case\s*#?\s*(\d+)/i);
  return {
    action: actionMatch[1].toLowerCase(),
    caseNum: caseMatch ? caseMatch[1] : null,
  };
}

/** Case-insensitive embed field lookup, tolerant of a trailing colon in the field name. */
function getEmbedField(embed, ...names) {
  const wanted = names.map((n) => n.toLowerCase());
  const field = embed.fields?.find((f) =>
    wanted.includes(f.name.replace(/:$/, "").trim().toLowerCase()),
  );
  return field?.value?.trim() ?? null;
}

/**
 * Resolves a moderator to a Discord user ID from a Carl-bot field value,
 * which may be a real mention ("<@123...>") or a plain username string
 * ("blak_boomer"). Falls back to a live guild member search (prefix
 * match on username) if the member isn't in cache.
 */
async function resolveModeratorId(guild, rawValue) {
  if (!rawValue) return null;

  const mentionMatch = rawValue.match(/<@!?(\d+)>/);
  if (mentionMatch) {
    const id = mentionMatch[1];
    const cached = guild.members.cache.get(id);
    return { id, username: cached?.user.username ?? null };
  }

  const usernameGuess = rawValue.split(/\s+/)[0].replace(/^@/, "");
  if (!usernameGuess) return null;

  let member = guild.members.cache.find(
    (m) => m.user.username.toLowerCase() === usernameGuess.toLowerCase(),
  );

  if (!member) {
    try {
      const fetched = await guild.members.fetch({
        query: usernameGuess,
        limit: 5,
      });
      member =
        fetched.find(
          (m) => m.user.username.toLowerCase() === usernameGuess.toLowerCase(),
        ) ?? null;
    } catch (err) {
      console.error("[ModCredits] Member search failed:", err);
    }
  }

  return member ? { id: member.user.id, username: member.user.username } : null;
}

async function handleCarlBotModLog(message) {
  const embed = message.embeds[0];
  if (!embed?.title) return;

  const parsed = parseCarlBotTitle(embed.title);
  if (!parsed) return;

  // Timeouts stay on the audit-log path — don't double-credit here.
  if (parsed.action === "timeout") return;

  const actionConfig = CARLBOT_ACTION_CREDITS[parsed.action];
  if (!actionConfig) {
    console.log(
      `[ModCredits] "${parsed.action}" has no configured credit value yet — skipping case ${parsed.caseNum ?? "?"}.`,
    );
    return;
  }

  const modRaw = getEmbedField(embed, "responsible moderator");
  const resolved = await resolveModeratorId(message.guild, modRaw);

  if (!resolved) {
    console.warn(
      `[ModCredits] Could not resolve moderator from "${modRaw}" for case ${parsed.caseNum ?? "?"} — no credits awarded.`,
    );
    return;
  }

  await awardCredits({
    guildId: message.guild.id,
    userId: resolved.id,
    username: resolved.username,
    credits: actionConfig.credits,
    reason: `${actionConfig.label} | ${parsed.caseNum ?? "?"}`,
    sourceId: message.id,
  });
}

// ─── Ticket-close auto-credit ───────────────────────────────────────────────────

async function handleTicketClose(message) {
  const embed = message.embeds[0];
  if (!embed?.title || !/ticket closed/i.test(embed.title)) return;

  const closedByRaw = getEmbedField(embed, "closed by");
  const ticketId = getEmbedField(embed, "ticket id");

  const mentionMatch = closedByRaw?.match(/<@!?(\d+)>/);
  if (!mentionMatch) {
    console.warn(
      `[TicketCredits] No valid "Closed By" mention on ticket ${ticketId ?? "?"} — no credits awarded.`,
    );
    return;
  }

  const userId = mentionMatch[1];
  let username = null;
  try {
    const member = await message.guild.members.fetch(userId);
    username = member.user.username;
    if (member.user.bot) return; // don't credit a bot for auto-closing
  } catch {
    // Member may have left — still award credits under the ID we have.
  }

  await awardCredits({
    guildId: message.guild.id,
    userId,
    username,
    credits: TICKET_CLOSE_CREDITS,
    reason: `Ticket | ${ticketId ?? "?"}`,
    sourceId: message.id,
  });
}

module.exports.isCommissionSpam = isCommissionSpam;
