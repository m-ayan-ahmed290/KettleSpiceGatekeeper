const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeSettings, guildChannel } = require('../utilities/guildSettings');
const preset = require('../presets/kettle.json');
const { copyCollection, checkLegacyIdentities } = require('../utilities/legacyMigration');
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
  const connection = { collection(name) { assert.equal(name, 'creditschemas'); return { find() { return (async function* () { yield* source; })(); } }; } };
  const model = { async updateOne(identity, update, options) { writes.push({ identity, update, options }); return { upsertedCount: 1 }; } };
  const count = await copyCollection('creditschemas', model, ['UserID'], 'kettle', connection);
  assert.equal(count, 2);
  assert.deepEqual(writes[0].identity, { GuildID: 'kettle', UserID: 'mod' });
  assert.deepEqual(writes[1].identity, { GuildID: 'original-guild', UserID: 'other' });
  assert.equal(writes[0].update.$set, undefined); assert.deepEqual(writes[0].update.$setOnInsert.Action, source[0].Action);
  assert.equal(source[0].GuildID, undefined); assert.equal(source[0]._id, 'legacy');
});
test('legacy import refuses malformed identities and leaves source data untouched', async () => {
  const connection = { collection() { return { find() { return (async function* () { yield { _id: 'bad', Credits: 5 }; })(); } }; } };
  await assert.rejects(copyCollection('creditschemas', { updateOne() { assert.fail(); } }, ['UserID'], 'kettle', connection), /missing required identifiers/);
});
test('every guild data schema defines a guild-aware identity', () => {
  for (const [name, expected] of [['credits','UserID'],['legacyCredits','UserID'],['birthdays','UserID'],['shipSchema','ShipName'],['blockWordsSchema','BlockWord'],['commissionOffender','UserID']]) {
    const model = require(`../schemas/${name}`);
    assert.ok(model.schema.indexes().some(([keys, options]) => keys.GuildID === 1 && keys[expected] === 1 && options.unique));
    assert.ok(!model.schema.indexes().some(([keys, options]) => keys.UserID === 1 && !keys.GuildID && options.unique));
  }
});

test('legacy migration refuses ambiguous duplicate credit identities before copying', async () => {
  const connection = { collection() { return { aggregate() { return { next: async () => ({ count: 2 }) }; } }; } };
  await assert.rejects(checkLegacyIdentities('creditschemas', ['UserID'], 'kettle', connection), /Duplicate identities/);
});
