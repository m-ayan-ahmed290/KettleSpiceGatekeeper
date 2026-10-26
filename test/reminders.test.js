const { test } = require('node:test');
const assert = require('node:assert/strict');
const modelPath = require.resolve('../schemas/reminder');
let pending = [], counts = 0, fail = false, updates = [], deleted = [];
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  countDocuments: async () => counts,
  create: async doc => ({ ...doc, _id: 'created' }),
  findOneAndUpdate(query, update, options) {
    assert.equal(options.sort.DueAt, 1); assert.equal(update.$inc.Attempts, 1);
    return { lean: async () => pending.shift() || null };
  },
  deleteOne: async query => { deleted.push(query); },
  updateOne: async (query, update) => { updates.push(update); },
} };
const { createReminder, deliverDueReminders } = require('../utilities/reminders');
const client = { users: { fetch: async () => ({ send: async payload => {
  if (fail) { const error = new Error('DM blocked'); error.code = 50007; throw error; }
  assert.deepEqual(payload.allowedMentions, { parse: [] });
} }) } };
test('reminder validates duration and pending quota before persistence', async () => {
  const input = { userId: 'u', guildId: 'g', text: 'Tea', duration: '1m' };
  const reminder = await createReminder(input);
  assert.equal(reminder.Text, 'Tea'); assert.ok(reminder.DueAt > new Date());
  await assert.rejects(createReminder({ ...input, duration: 'now' }), /duration/);
  counts = 10; await assert.rejects(createReminder(input), /10 pending/); counts = 0;
});
test('worker processes only ten due reminders per pass and cleans delivered rows', async () => {
  pending = Array.from({ length: 12 }, (_, n) => ({ _id: String(n), UserID: 'u', Text: '@everyone Tea', DueAt: new Date(), Attempts: 1 }));
  await deliverDueReminders(client);
  assert.equal(deleted.length, 10); assert.equal(pending.length, 2);
  await deliverDueReminders(client); assert.equal(deleted.length, 12);
});
test('permanent DM failure is persisted instead of retrying indefinitely', async () => {
  fail = true;
  pending = [{ _id: 'failure', UserID: 'u', Text: 'Tea', DueAt: new Date(), Attempts: 1 }];
  await deliverDueReminders(client);
  assert.equal(updates.at(-1).$set.Status, 'failed');
});
test('cancellation scopes records to both author and server', async () => {
  const path = require.resolve('../schemas/reminder');
  let query, reply;
  require.cache[path].exports.findOneAndDelete = async value => { query = value; return {}; };
  await require('../commands/remind').execute({
    user: { id: 'author' }, guild: { id: 'guild' },
    options: { getSubcommand: () => 'cancel', getString: () => '0123456789abcdef01234567' },
    deferReply: async () => {}, editReply: async p => { reply = p; },
  });
  assert.deepEqual(query, { UserID: 'author', GuildID: 'guild', _id: '0123456789abcdef01234567' });
  assert.match(reply.content, /cancelled/);
});
