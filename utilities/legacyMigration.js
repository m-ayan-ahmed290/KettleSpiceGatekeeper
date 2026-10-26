const mongoose = require("mongoose");
const primary = process.env.LEGACY_GUILD_ID || require("../presets/kettle.json").primaryGuildId;
const Marker = mongoose.model("LegacyImport", new mongoose.Schema({ _id: String, CompletedAt: Date }));
const mappings = [
  ["creditschemas", "credits", ["UserID"]], ["legacycredits", "legacyCredits", ["UserID"]],
  ["birthdays", "birthdays", ["UserID"]], ["blockwords", "blockWordsSchema", ["BlockWord"]],
  ["shipschemas", "shipSchema", ["ShipName"]], ["imglinks", "imgLinks", []],
  ["commissionoffenders", "commissionOffender", ["UserID"]],
];
async function copyCollection(source, target, keys, fallback, connection = mongoose.connection) {
  let inserted = 0, skipped = 0;
  for await (const row of connection.collection(source).find({}, { batchSize: 25 })) {
    const { _id, __v, ...data } = row;
    data.GuildID = data.GuildID || fallback;
    if (keys.some(key => !data[key])) { skipped++; continue; }
    const identity = { GuildID: data.GuildID, ...Object.fromEntries(keys.map(key => [key, data[key]])) };
    const result = await target.updateOne(identity, { $setOnInsert: data }, { upsert: true, setDefaultsOnInsert: false });
    inserted += result.upsertedCount || 0;
  }
  if (skipped) throw new Error(`Legacy ${source} contains ${skipped} records missing required identifiers; originals were retained. Repair them before restarting.`);
  return inserted;
}
async function checkLegacyIdentities(source, keys, fallback, connection = mongoose.connection) {
  if (!keys.length || source === "blockwords") return;
  const group = { GuildID: { $cond: [{ $eq: [{ $ifNull: ["$GuildID", ""] }, ""] }, fallback, "$GuildID"] }, ...Object.fromEntries(keys.map(key => [key, `$${key}`])) };
  const duplicate = await connection.collection(source).aggregate([
    { $group: { _id: group, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $limit: 1 },
  ], { allowDiskUse: true }).next();
  if (duplicate) throw new Error(`Duplicate identities in legacy ${source}. Originals were retained; reconcile duplicates from a backup before restarting. See KETTLE_SETUP.md.`);
}
async function migrateLegacyData(guildIds = []) {
  if (process.env.IMPORT_LEGACY_DATA === "false") return;
  if (process.env.LEGACY_GUILD_ID && !guildIds.includes(primary)) throw new Error("LEGACY_GUILD_ID must identify a server this bot has joined");
  if (!process.env.LEGACY_GUILD_ID && !guildIds.some(id => require("../presets/kettle.json").guilds[id])) return;
  const key = `guild-v3:${primary}`;
  if (await Marker.exists({ _id: key })) return;
  for (const [source, file, keys] of mappings) {
    await checkLegacyIdentities(source, keys, primary);
    const model = require(`../schemas/${file}`);
    await model.init();
    const copied = await copyCollection(source, model, keys, primary);
    console.log(`[Migration] ${source}: copied ${copied}; existing guild records and original collection retained.`);
  }
  await Marker.updateOne({ _id: key }, { $set: { CompletedAt: new Date() } }, { upsert: true });
}
module.exports = { migrateLegacyData, copyCollection, checkLegacyIdentities, mappings };
