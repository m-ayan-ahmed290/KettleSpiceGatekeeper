const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const modelPath = require.resolve('../schemas/birthdays');
let claimed = '', sends = 0, shouldFail = false;
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  async findOneAndUpdate(query, update) {
    if (claimed === query.LastWished.$ne) return null;
    claimed = update.$set.LastWished;
    return { _id: 'birthday' };
  },
  async updateOne(query, update) { if (claimed === query.LastWished) claimed = update.$set.LastWished; },
} };
const { processBirthday } = require('../events/ready');
const { vipBDCh } = require('../config.json');
const now = new Date();
const birthday = { _id: 'birthday', UserID: '123', GuildID: 'guild', Date: new Date(Date.UTC(2000, now.getUTCMonth(), now.getUTCDate())), Timezone: 0, HasRole: true };
const client = {
  guilds: { cache: new Collection([['guild', { iconURL: () => null, channels: { cache: new Collection([[vipBDCh, { async send() { if (shouldFail) throw new Error('send failed'); sends++; } }]]) } }]]) },
  users: { fetch: async () => ({ username: 'Alice', displayAvatarURL: () => 'https://example.test/avatar.png' }) },
};
test('concurrent birthday checks and a subsequent restart check send only once', async () => {
  await Promise.all(Array.from({ length: 10 }, () => processBirthday(client, birthday)));
  assert.equal(sends, 1);
  await processBirthday(client, birthday);
  assert.equal(sends, 1);
});
test('failed delivery releases the persistent birthday claim for retry', async () => {
  claimed = ''; shouldFail = true;
  await assert.rejects(processBirthday(client, birthday), /send failed/);
  assert.equal(claimed, '');
  shouldFail = false;
  await processBirthday(client, birthday);
  assert.equal(sends, 2);
});
after(() => require('../utilities/client').destroy());
