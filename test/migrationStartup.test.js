const { test } = require('node:test');
const assert = require('node:assert/strict');
const preset = require('../presets/kettle.json');
const primary = preset.primaryGuildId;
const sources = {
  creditschemas: [
    { _id: 'first', UserID: 'mod', Credits: 50, Action: [{ Credit: '+50' }] },
    { _id: 'second', UserID: 'mod', Credits: 70, Action: [{ Credit: '+70' }] },
  ],
};
const original = structuredClone(sources);
const reports = [], stores = new Map();
let complete = false;
const cursor = rows => ({ sort() { return this; }, async *[Symbol.asyncIterator]() { yield* rows; } });
const fakeMongoose = {
  Schema: class {},
  model: () => ({ exists: async () => complete, updateOne: async () => { complete = true; } }),
  connection: { collection(name) { return {
    find: () => cursor(sources[name] || []),
    findOne: async query => (sources[name] || []).find(row => row.UserID === query.UserID),
    aggregate: () => cursor(name === 'creditschemas' ? [{ _id: { GuildID: primary, UserID: 'mod' }, count: 2 }] : []),
  }; } },
};
const mongoosePath = require.resolve('mongoose');
require.cache[mongoosePath] = { id: mongoosePath, filename: mongoosePath, loaded: true, exports: fakeMongoose };
const reviewPath = require.resolve('../schemas/importReview');
require.cache[reviewPath] = { id: reviewPath, filename: reviewPath, loaded: true, exports: { init: async () => {}, updateOne: async (query, update) => reports.push(update.$set) } };
for (const name of ['credits', 'legacyCredits', 'birthdays', 'blockWordsSchema', 'shipSchema', 'imgLinks', 'commissionOffender']) {
  const modelPath = require.resolve(`../schemas/${name}`), records = new Map(); stores.set(name, records);
  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
    init: async () => {}, updateOne: async (identity, update) => {
      const key = JSON.stringify(identity); if (records.has(key)) return { upsertedCount: 0 };
      records.set(key, structuredClone(update.$setOnInsert)); return { upsertedCount: 1 };
    },
  } };
}
const { migrateLegacyData } = require('../utilities/legacyMigration');
test('startup import completes its marker despite duplicate credits and preserves later awards on restart', async () => {
  await migrateLegacyData([primary]);
  assert.equal(complete, true);
  assert.equal(reports.length, 1); assert.equal(reports[0].Kind, 'duplicate');
  assert.equal(reports[0].RecordCount, 2);
  const active = [...stores.get('credits').values()][0];
  assert.equal(active.Credits, 50); assert.deepEqual(active.Action, [{ Credit: '+50' }]);
  active.Credits = 60;
  await migrateLegacyData([primary]);
  assert.equal(active.Credits, 60); assert.deepEqual(sources, original);
});
