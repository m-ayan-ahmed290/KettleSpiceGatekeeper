const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mongoose, initializeModels } = require('../utilities/database');

test('real Mongoose models wait for connection, build unique indexes, then fail fast on disconnect', async () => {
  await assert.rejects(initializeModels(), /Connect MongoDB/);
  for (const file of fs.readdirSync(path.join(__dirname, '../schemas')).filter(file => file.endsWith('.js'))) {
    require(`../schemas/${file}`);
  }
  require('../utilities/legacyMigration');
  let settled = false;
  const initialization = Promise.all(Object.values(mongoose.models).map(model => model.init()));
  initialization.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'preloaded model initialization must wait for the driver');

  // Only the driver boundary is fake: model compilation, init(), queues and
  // collection/index methods execute through the installed Mongoose library.
  const created = [], indexes = [];
  let releaseIndexes;
  const indexGate = new Promise(resolve => { releaseIndexes = resolve; });
  mongoose.connection.db = {
    async createCollection(name) { created.push(name); },
    collection(name) { return { async createIndex(keys, options) {
      await indexGate;
      indexes.push({ name, keys, options });
      return 'test_index';
    } }; },
  };
  mongoose.connection.onOpen();
  const ready = initializeModels();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mongoose.get('bufferCommands'), true, 'keep startup pending until indexes finish');
  assert.equal(settled, false);
  releaseIndexes();
  await ready;
  await initialization;
  assert.ok(created.includes('legacyimportreviews'));
  assert.ok(created.includes('guildcredits'));
  assert.ok(indexes.some(index => index.name === 'guildcredits' && index.keys.GuildID === 1 && index.keys.UserID === 1 && index.options.unique));
  assert.equal(mongoose.get('bufferCommands'), false);
  mongoose.connection.readyState = 0;
  for (const collection of Object.values(mongoose.connection.collections)) {
    collection.collection = null;
    collection.onClose();
  }
  mongoose.connection.db = undefined;
  await assert.rejects(mongoose.models.GuildCredit.findOne({ GuildID: 'test', UserID: 'test' }), /bufferCommands = false/);
});
