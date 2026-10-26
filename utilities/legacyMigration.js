const mongoose = require('mongoose');
const primary = process.env.LEGACY_GUILD_ID || require('../presets/kettle.json').primaryGuildId;
const Marker = mongoose.model('LegacyImport', new mongoose.Schema({ _id: String, CompletedAt: Date }));
const Review = require('../schemas/importReview');
const mappings = [
  ['creditschemas', 'credits', ['UserID']], ['legacycredits', 'legacyCredits', ['UserID']],
  ['birthdays', 'birthdays', ['UserID']], ['blockwords', 'blockWordsSchema', ['BlockWord']],
  ['shipschemas', 'shipSchema', ['ShipName']], ['imglinks', 'imgLinks', []],
  ['commissionoffenders', 'commissionOffender', ['UserID']],
];
function guildExpression(fallback) {
  return { $cond: [{ $eq: [{ $ifNull: ['$GuildID', ''] }, ''] }, fallback, '$GuildID'] };
}
async function saveReview(reviews, source, identity, kind, count, firstId) {
  const identityKey = kind === 'missing-identifier' ? `record:${firstId}` : JSON.stringify(identity);
  await reviews.updateOne({ GuildID: identity.GuildID, Source: source, IdentityKey: identityKey }, {
    $set: { Identity: identity, Kind: kind, RecordCount: count, FirstRecordId: String(firstId) },
  }, { upsert: true });
}
async function copyCollection(source, target, keys, fallback, connection = mongoose.connection, reviews = Review) {
  let inserted = 0, skipped = 0;
  // Natural order retains the first-record baseline used by the old findOne lookups.
  // $setOnInsert protects already imported records and makes interrupted imports retryable.
  for await (const row of connection.collection(source).find({}, { batchSize: 25 }).sort({ $natural: 1 })) {
    const { _id, __v, ...data } = row;
    data.GuildID = data.GuildID || fallback;
    const identity = { GuildID: data.GuildID, ...Object.fromEntries(keys.filter(key => data[key]).map(key => [key, data[key]])) };
    if (keys.some(key => !data[key])) {
      await saveReview(reviews, source, identity, 'missing-identifier', 1, _id);
      skipped++; continue;
    }
    const result = await target.updateOne(identity, { $setOnInsert: data }, { upsert: true, setDefaultsOnInsert: false });
    inserted += result.upsertedCount || 0;
  }
  if (skipped) console.warn(`[Migration] ${source}: ${skipped} malformed record(s) retained in the source and listed in /migration-review.`);
  return inserted;
}
async function checkLegacyIdentities(source, keys, fallback, connection = mongoose.connection, reviews = Review) {
  if (!keys.length || source === 'blockwords') return 0;
  const group = { GuildID: guildExpression(fallback), ...Object.fromEntries(keys.map(key => [key, `$${key}`])) };
  const duplicates = connection.collection(source).aggregate([
    { $group: { _id: group, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } },
  ], { allowDiskUse: true, batchSize: 25 });
  let count = 0;
  for await (const duplicate of duplicates) {
    const identity = duplicate._id;
    const query = sourceIdentityQuery(identity, fallback);
    const first = await connection.collection(source).findOne(query, { projection: { _id: 1 }, sort: { $natural: 1 } });
    await saveReview(reviews, source, identity, 'duplicate', duplicate.count, first?._id || 'unknown');
    count++;
  }
  if (count) console.warn(`[Migration] ${source}: ${count} duplicate identity group(s); keeping the first legacy baseline, never summing balances. Originals retained. Use /migration-review.`);
  return count;
}
function sourceIdentityQuery(identity, fallback = primary) {
  const { GuildID, ...keys } = identity;
  return { ...keys, $or: [
    { GuildID }, ...(GuildID === fallback ? [{ GuildID: { $exists: false } }, { GuildID: null }, { GuildID: '' }] : []),
  ] };
}
async function migrateLegacyData(guildIds = []) {
  if (process.env.IMPORT_LEGACY_DATA === 'false') return;
  if (process.env.LEGACY_GUILD_ID && !guildIds.includes(primary)) throw new Error('LEGACY_GUILD_ID must identify a server this bot has joined');
  if (!process.env.LEGACY_GUILD_ID && !guildIds.some(id => require('../presets/kettle.json').guilds[id])) return;
  const key = `guild-v3:${primary}`;
  if (await Marker.exists({ _id: key })) return;
  await Review.init();
  for (const [source, file, keys] of mappings) {
    await checkLegacyIdentities(source, keys, primary);
    const model = require(`../schemas/${file}`);
    await model.init();
    const copied = await copyCollection(source, model, keys, primary);
    console.log(`[Migration] ${source}: copied ${copied}; existing guild records and original collection retained.`);
  }
  await Marker.updateOne({ _id: key }, { $set: { CompletedAt: new Date() } }, { upsert: true });
}
module.exports = { migrateLegacyData, copyCollection, checkLegacyIdentities, sourceIdentityQuery, mappings };
