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
const vipBDCh = 'birthday-channel';
const settingsPath = require.resolve('../utilities/guildSettings');
require.cache[settingsPath] = { id: settingsPath, filename: settingsPath, loaded: true, exports: {
  getGuildSettings: async () => ({ features: { birthdays: true }, birthday: { vipRoles: ['vip'], vipRoleNames: [], eligibleRoles: [], allowEveryone: false }, channels: { birthdayVip: vipBDCh } }),
  guildChannel: async (guild, id) => guild.channels.cache.get(id),
} };
const { processBirthday } = require('../events/ready');
const now = new Date();
const birthday = { _id: 'birthday', UserID: '123', GuildID: 'guild', Date: new Date(Date.UTC(2000, now.getUTCMonth(), now.getUTCDate())), Timezone: 0, HasRole: true };
const client = {
  guilds: { cache: new Collection([['guild', { id: 'guild', name: 'Test', members: { fetch: async () => ({ user: { username: 'Alice', displayAvatarURL: () => 'https://example.test/a.png' }, roles: { cache: new Collection([['vip', { id: 'vip', name: 'VIP' }]]) } }) }, iconURL: () => null, channels: { cache: new Collection([[vipBDCh, { async send() { if (shouldFail) throw new Error('send failed'); sends++; } }]]) } }]]) },
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
