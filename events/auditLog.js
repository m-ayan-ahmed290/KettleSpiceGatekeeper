/**
 * auditLog.js — Polls Discord's audit log every 5 hours and awards
 * moderator credits for timeouts only.
 *
 * Every other moderation action (ban, warn, kick, mute) is now
 * credited from the Carl-bot mod-log embeds and the Tickets-v2
 * transcript embeds instead — see events/messageCreate.js. Timeouts
 * stay on the audit log because Carl-bot's embed for a timeout does
 * not reliably include a case number/reason the same way bans/warns/
 * kicks do, per your instruction to keep timeout on audit-log for now.
 */

const client = require("../utilities/client");
const { guildId } = require("../config.json");
const ProcessedLogId = require("../schemas/pLogId");
const { awardCredits } = require("../utilities/awardCredits");
const chalk = require("chalk");

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often to poll the audit log (5 hours). */
const CHECK_INTERVAL_MS = 5 * 60 * 60 * 1000;

/** Only process audit entries created within this window (8 hours). */
const ENTRY_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/** Credits awarded per timeout. */
const TIMEOUT_CREDITS = 6;

/** Audit log action type we care about: MEMBER_UPDATE (covers timeouts). */
const ACTION_TYPES = [24];

// ─── Module export ────────────────────────────────────────────────────────────

module.exports = {
  name: "auditLogCheck",
  once: false,

  async execute() {
    console.log(
      chalk.bgGray.white.bold(" 📜  ") +
        chalk.gray("Audit Log Check started (timeouts only)"),
    );

    setInterval(() => runAuditCheck(), CHECK_INTERVAL_MS);
  },
};

// ─── Core audit-check function ────────────────────────────────────────────────

async function runAuditCheck() {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error("Guild not found");

    await Promise.all(
      ACTION_TYPES.map((type) => processActionType(guild, type)),
    );
  } catch (error) {
    console.error("[AuditLog] Error during audit check:", error);
  }
}

async function processActionType(guild, type) {
  const auditLogs = await guild.fetchAuditLogs({ limit: 20, type });

  await Promise.all(
    Array.from(auditLogs.entries.values()).map((entry) => processEntry(entry)),
  );
}

async function processEntry(entry) {
  const { executor, id, createdTimestamp, changes, target } = entry;

  // Ignore bot actions and stale entries
  if (executor.bot || Date.now() - createdTimestamp > ENTRY_MAX_AGE_MS) return;

  // Skip already-processed entries (idempotency)
  if (await ProcessedLogId.exists({ logId: id })) return;
  await new ProcessedLogId({ logId: id }).save();

  // Only credit actual timeouts (communication_disabled_until being set)
  const muteChange = changes?.find(
    (c) => c.key === "communication_disabled_until",
  );
  if (!muteChange || muteChange.new === null) return;

  const reason = `Timeout${target ? ` | ${target.username}` : ""}`;

  await awardCredits({
    userId: executor.id,
    username: executor.username,
    credits: TIMEOUT_CREDITS,
    reason,
  });
}
