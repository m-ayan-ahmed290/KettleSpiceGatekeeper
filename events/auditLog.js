/**
 * auditLog.js — Polls Discord's audit log every 5 minutes and awards
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

/** How often to poll the audit log (5 minutes). */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

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

    await runAuditCheck();
    setInterval(() => runAuditCheck(), CHECK_INTERVAL_MS).unref();
  },
};

// ─── Core audit-check function ────────────────────────────────────────────────

let jobRunning = false;
async function runAuditCheck() {
  if (jobRunning) return;
  jobRunning = true;
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) throw new Error("Guild not found");

    await Promise.all(
      ACTION_TYPES.map((type) => processActionType(guild, type)),
    );
  } catch (error) {
    console.error("[AuditLog] Error during audit check:", error);
  } finally { jobRunning = false; }
}

async function processActionType(guild, type) {
  let before;
  for (let page = 0; page < 10; page++) {
    const logs = await guild.fetchAuditLogs({ limit: 100, type, before });
    for (const entry of logs.entries.values()) await processEntry(entry);
    const last = logs.entries.last();
    if (!last || logs.entries.size < 100 || Date.now() - last.createdTimestamp > ENTRY_MAX_AGE_MS) break;
    before = last.id;
  }
}

async function processEntry(entry) {
  const { executor, id, createdTimestamp, changes, target } = entry;

  // Ignore bot actions and stale entries
  if (!executor || executor.bot || Date.now() - createdTimestamp > ENTRY_MAX_AGE_MS) return;

  // Skip already-processed entries (idempotency)
  if (await ProcessedLogId.exists({ logId: id })) return;

  // Only credit actual timeouts (communication_disabled_until being set)
  const muteChange = changes?.find(
    (c) => c.key === "communication_disabled_until",
  );
  if (!muteChange || !muteChange.new) return;

  const reason = `Timeout${target ? ` | ${target.username}` : ""}`;

  await awardCredits({
    userId: executor.id,
    username: executor.username,
    credits: TIMEOUT_CREDITS,
    reason,
    sourceId: id,
  });
  await ProcessedLogId.updateOne({ logId: id }, { $setOnInsert: { logId: id } }, { upsert: true });
}
