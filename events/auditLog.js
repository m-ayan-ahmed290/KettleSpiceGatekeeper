const client = require('../utilities/client');
const { getGuildSettings } = require('../utilities/guildSettings');
const ProcessedLogId = require('../schemas/pLogId');
const { awardCredits } = require('../utilities/awardCredits');
let checking = false, timer;
async function runAuditCheck() {
  if (checking || !client.dataReady) return;
  checking = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      const settings = await getGuildSettings(guild.id);
      if (!settings.features.credits) continue;
      try {
        let before;
        for (let page = 0; page < 10; page++) {
          const logs = await guild.fetchAuditLogs({ limit: 100, type: 24, before });
          for (const entry of logs.entries.values()) await processEntry(entry, guild.id);
          const last = logs.entries.last();
          if (!last || logs.entries.size < 100 || Date.now() - last.createdTimestamp > 8 * 3600_000) break;
          before = last.id;
        }
      } catch (error) { console.warn(`[Audit:${guild.id}]`, error.message); }
    }
  } finally { checking = false; }
}
async function processEntry(entry, guildId) {
  const { executor, id, createdTimestamp, changes, target } = entry;
  if (!executor || executor.bot || Date.now() - createdTimestamp > 8 * 3600_000) return;
  if (!changes?.some(change => change.key === 'communication_disabled_until' && change.new)) return;
  if (await ProcessedLogId.exists({ logId: id })) return;
  await awardCredits({ guildId, userId: executor.id, username: executor.username, credits: 6,
    reason: `Timeout${target ? ` | ${target.username}` : ''}`, sourceId: id });
  await ProcessedLogId.updateOne({ logId: id }, { $setOnInsert: { logId: id } }, { upsert: true });
}
module.exports = { name: 'auditLogCheck', async execute() {
  if (timer) return;
  await runAuditCheck();
  timer = setInterval(() => runAuditCheck().catch(error => console.warn('[Audit]', error.message)), 5 * 60_000);
  timer.unref();
}, processEntry };
