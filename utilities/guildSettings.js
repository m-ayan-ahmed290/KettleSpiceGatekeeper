const mongoose = require("mongoose");
const Settings = require("../schemas/guildSettings");
const preset = require("../presets/kettle.json");
const cache = new Map(), loading = new Map(), unavailableChannels = new Map();
const defaults = {
  brand: "", channels: { moderation: "", deleted: "", media: "", birthdayVip: "", birthdayStandard: "", restricted: "", status: "" },
  features: { commission: false, credits: false, egg: false, birthdays: false, roles: false },
  birthday: { vipRoles: [], vipRoleNames: [], eligibleRoles: [], allowEveryone: true },
  integrations: { carlBotId: "", ticketsBotId: "", ticketChannelId: "" }, roles: [], blockedGameUsers: [],
};
function mergeSettings(guildId, data = {}) {
  const legacy = preset.guilds[guildId] || {};
  const merged = { ...structuredClone(defaults), ...structuredClone(legacy), ...structuredClone(data) };
  for (const key of ["channels", "features", "birthday", "integrations"])
    merged[key] = structuredClone({ ...defaults[key], ...legacy[key], ...data[key] });
  return merged;
}
async function getGuildSettings(guildId) {
  if (typeof guildId !== "string" || !guildId) throw new Error("A guild ID is required");
  const cached = cache.get(guildId);
  if (mongoose.connection.readyState !== 1) return structuredClone(cached?.value || mergeSettings(guildId));
  if (cached?.until > Date.now()) return structuredClone(cached.value);
  if (!loading.has(guildId)) loading.set(guildId, (async () => {
    const doc = mongoose.connection.readyState === 1 ? await Settings.findOne({ GuildID: guildId }).lean() : null;
    const value = mergeSettings(guildId, doc?.Data);
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(guildId, { value, until: Date.now() + 60_000 });
    return value;
  })().finally(() => loading.delete(guildId)));
  return structuredClone(await loading.get(guildId));
}
async function updateGuildSettings(guildId, patch) {
  const set = Object.fromEntries(Object.entries(patch).map(([key, value]) => [`Data.${key}`, value]));
  await Settings.updateOne({ GuildID: guildId }, { $set: set, $setOnInsert: { GuildID: guildId } }, { upsert: true });
  cache.delete(guildId);
}
async function guildChannel(guild, channelId) {
  if (!channelId) return null;
  const key = `${guild.id}:${channelId}`;
  if ((unavailableChannels.get(key) || 0) > Date.now()) return null;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.guildId === guild.id && typeof channel.send === "function") return channel;
  if (unavailableChannels.size >= 200) unavailableChannels.delete(unavailableChannels.keys().next().value);
  unavailableChannels.set(key, Date.now() + 60_000);
  return null;
}
function invalidateGuildSettings(guildId) { cache.delete(guildId); }
module.exports = { getGuildSettings, updateGuildSettings, mergeSettings, guildChannel, invalidateGuildSettings };
