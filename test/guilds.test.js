const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeSettings, guildChannel } = require('../utilities/guildSettings');
const preset = require('../presets/kettle.json');
const { copyCollection, checkLegacyIdentities, sourceIdentityQuery } = require('../utilities/legacyMigration');
test('new guilds inherit no Kettle destinations, restricted channels, role rules or automations', () => {
  const settings = mergeSettings('new-guild');
  assert.ok(Object.values(settings.channels).every(value => value === ''));
  assert.ok(Object.values(settings.features).every(value => value === false));
  assert.deepEqual(settings.roles, []); assert.deepEqual(settings.blockedGameUsers, []);
});
test('Kettle defaults stay bound to their original guild IDs and preserve role mappings', () => {
  const primary = mergeSettings(preset.primaryGuildId);
  assert.equal(primary.features.commission, true); assert.equal(primary.features.credits, true);
  const second = mergeSettings(Object.keys(preset.guilds).find(id => id !== preset.primaryGuildId));
  assert.equal(second.features.roles, true); assert.equal(second.roles.length, 3);
  const overridden = mergeSettings(preset.primaryGuildId, { features: { commission: false }, channels: { restricted: '' } });
  assert.equal(overridden.features.commission, false); assert.equal(overridden.channels.restricted, '');
  assert.equal(overridden.features.credits, true);
});
test('settings returned to different guilds do not share mutable arrays', () => {
  const a = mergeSettings('a'), b = mergeSettings('b'); a.birthday.vipRoles.push('role');
  assert.deepEqual(b.birthday.vipRoles, []); assert.deepEqual(mergeSettings('c').birthday.vipRoles, []);
});
test('channel resolution rejects destinations belonging to another guild', async () => {
  const foreign = { guildId: 'other', send: async () => {} };
  const guild = { id: 'current', channels: { cache: new Map([['channel', foreign]]) } };
  assert.equal(await guildChannel(guild, 'channel'), null);
});
test('legacy import uses guild identities, preserves histories and never overwrites or deletes source rows', async () => {
  const source = [{ _id: 'legacy', UserID: 'mod', Credits: 42, Action: [{ Credit: '+42' }] }, { _id: 'second', UserID: 'other', GuildID: 'original-guild', Credits: 12 }];
  const writes = [];
  const connection = { collection(name) { assert.equal(name, 'creditschemas'); return { find() { return { sort() { return (async function* () { yield* source; })(); } }; } }; } };
  const model = { async updateOne(identity, update, options) { writes.push({ identity, update, options }); return { upsertedCount: 1 }; } };
  const count = await copyCollection('creditschemas', model, ['UserID'], 'kettle', connection);
  assert.equal(count, 2);
  assert.deepEqual(writes[0].identity, { GuildID: 'kettle', UserID: 'mod' });
  assert.deepEqual(writes[1].identity, { GuildID: 'original-guild', UserID: 'other' });
  assert.equal(writes[0].update.$set, undefined); assert.deepEqual(writes[0].update.$setOnInsert.Action, source[0].Action);
  assert.equal(source[0].GuildID, undefined); assert.equal(source[0]._id, 'legacy');
});
test('legacy import records malformed identities for review and keeps the bot startup moving', async () => {
  const warnings = [];
  const row = { _id: 'bad', Credits: 5 };
  const connection = { collection() { return { find() { return { sort() { return (async function* () { yield row; })(); } }; } }; } };
  const reviews = { async updateOne(query, update) { warnings.push({ query, update }); } };
  const count = await copyCollection('creditschemas', { updateOne() { assert.fail(); } }, ['UserID'], 'kettle', connection, reviews);
  assert.equal(count, 0); assert.equal(warnings[0].update.$set.Kind, 'missing-identifier');
  assert.equal(warnings[0].query.GuildID, 'kettle'); assert.equal(row.Credits, 5);
});
test('every guild data schema defines a guild-aware identity', () => {
  for (const [name, expected] of [['credits','UserID'],['legacyCredits','UserID'],['birthdays','UserID'],['shipSchema','ShipName'],['blockWordsSchema','BlockWord'],['commissionOffender','UserID']]) {
    const model = require(`../schemas/${name}`);
    assert.ok(model.schema.indexes().some(([keys, options]) => keys.GuildID === 1 && keys[expected] === 1 && options.unique));
    assert.ok(!model.schema.indexes().some(([keys, options]) => keys.UserID === 1 && !keys.GuildID && options.unique));
  }
});

test('legacy migration reports duplicate identities without aborting or changing a balance', async () => {
  const writes = [];
  const connection = { collection() { return {
    aggregate() { return (async function* () { yield { _id: { GuildID: 'kettle', UserID: 'mod' }, count: 2 }; })(); },
    findOne: async query => { assert.equal(query.UserID, 'mod'); return { _id: 'first-record' }; },
  }; } };
  const reviews = { async updateOne(query, update, options) { writes.push({ query, update, options }); } };
  const count = await checkLegacyIdentities('creditschemas', ['UserID'], 'kettle', connection, reviews);
  assert.equal(count, 1);
  assert.equal(writes[0].query.GuildID, 'kettle');
  assert.equal(writes[0].update.$set.RecordCount, 2);
  assert.equal(writes[0].update.$set.FirstRecordId, 'first-record');
  assert.equal(writes[0].update.$set.Credits, undefined);
});
test('duplicate imports retain the first balance and history, preserve source rows and isolate other guilds', async () => {
  const rows = [
    { _id: 'old', UserID: 'mod', Credits: 50, Action: [{ Credit: '+50' }] },
    { _id: 'duplicate', UserID: 'mod', Credits: 70, Action: [{ Credit: '+70' }] },
    { _id: 'other', GuildID: 'another-guild', UserID: 'mod', Credits: 9 },
  ];
  const original = structuredClone(rows), stored = new Map();
  const connection = { collection() { return { find() { return { sort(order) {
    assert.deepEqual(order, { $natural: 1 }); return (async function* () { yield* rows; })();
  } }; } }; } };
  const model = { async updateOne(query, update) {
    const key = JSON.stringify(query);
    if (stored.has(key)) return { upsertedCount: 0 };
    stored.set(key, structuredClone(update.$setOnInsert)); return { upsertedCount: 1 };
  } };
  assert.equal(await copyCollection('creditschemas', model, ['UserID'], 'kettle', connection), 2);
  const baseline = stored.get(JSON.stringify({ GuildID: 'kettle', UserID: 'mod' }));
  assert.equal(baseline.Credits, 50); assert.deepEqual(baseline.Action, [{ Credit: '+50' }]);
  assert.equal(stored.get(JSON.stringify({ GuildID: 'another-guild', UserID: 'mod' })).Credits, 9);
  baseline.Credits = 60; // A post-import award must survive a restart/retry.
  assert.equal(await copyCollection('creditschemas', model, ['UserID'], 'kettle', connection), 0);
  assert.equal(baseline.Credits, 60); assert.deepEqual(rows, original);
});
test('review queries include unscoped legacy records only for the fallback guild', () => {
  assert.equal(sourceIdentityQuery({ GuildID: 'kettle', UserID: 'mod' }, 'kettle').$or.length, 4);
  assert.deepEqual(sourceIdentityQuery({ GuildID: 'another', UserID: 'mod' }, 'kettle'), { UserID: 'mod', $or: [{ GuildID: 'another' }] });
});
