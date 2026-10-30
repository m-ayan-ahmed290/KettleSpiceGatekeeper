const mongoose = require('mongoose');
const { initializeModels } = require('../utilities/database');
const { EmbedBuilder } = require('discord.js');
const Birthday = require('../schemas/birthdays');
const { getGuildSettings, guildChannel } = require('../utilities/guildSettings');
const { birthdayToday, birthdayKey, age: birthdayAge } = require('../utilities/birthdayDates');
const { assignRolesToAllMembers } = require('../utilities/functions');
const { migrateLegacyData } = require('../utilities/legacyMigration');
module.exports = {
  name: 'clientReady', once: true,
  async execute(client) {
    try {
      const uri = process.env.MONGODB_URI || require('../config.json').mongoURL;
      if (!uri) throw new Error('Set MONGODB_URI to your existing MongoDB database');
      await mongoose.connect(uri, { maxPoolSize: 3, minPoolSize: 0, waitQueueTimeoutMS: 5_000, serverSelectionTimeoutMS: 10_000, socketTimeoutMS: 20_000 });
      await initializeModels();
      await migrateLegacyData([...client.guilds.cache.keys()]);
      client.dataReady = true;
      await client.application.commands.set([...client.commands.values()].map(command => command.data.toJSON()));
      client.user.setPresence({ activities: [{ name: '/help • games and community', type: 0 }], status: 'online' });
      console.log(`[Ready] ${client.user.tag}: ${client.commands.size} commands, ${client.guilds.cache.size} guilds.`);
      for (const guild of client.guilds.cache.values()) {
        const settings = await getGuildSettings(guild.id);
        const channel = await guildChannel(guild, settings.channels.status);
        if (channel) await channel.send(`✅ ${client.user.username} is online.`).catch(() => {});
      }
      (async () => { for (const guild of client.guilds.cache.values()) await assignRolesToAllMembers(guild); })()
        .catch(error => console.error('[RoleSync]', error.message));
      require('../utilities/reminders').startReminders(client);
      await checkBirthdays(client);
      setInterval(() => checkBirthdays(client), 15 * 60_000).unref();
      await require('./auditLog').execute();
    } catch (error) {
      console.error('[Startup] Database initialization or legacy import failed:', error.message);
      client.dataReady = false;
      client.destroy();
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    }
  },
};
let checking = false;
async function checkBirthdays(client) {
  if (checking || mongoose.connection.readyState !== 1) return;
  checking = true;
  try {
    for await (const birthday of Birthday.find().lean().cursor({ batchSize: 25 }))
      await processBirthday(client, birthday).catch(error => console.warn('[Birthday]', error.message));
  } catch (error) { console.error('[Birthday]', error.message); }
  finally { checking = false; }
}
async function processBirthday(client, birthday) {
  if (!birthday || !birthdayToday(birthday.Date, birthday.Timezone || 0)) return;
  const key = birthdayKey(birthday.Timezone || 0);
  if (birthday.LastWished === key) return;
  const guild = client.guilds.cache.get(birthday.GuildID);
  if (!guild) return;
  const settings = await getGuildSettings(guild.id);
  if (!settings.features.birthdays) return;
  const member = await guild.members.fetch(birthday.UserID).catch(() => null);
  if (!member) return;
  const vip = member.roles.cache.some(role => settings.birthday.vipRoles.includes(role.id) || settings.birthday.vipRoleNames.includes(role.name));
  if (!vip && !settings.birthday.allowEveryone && !member.roles.cache.some(role => settings.birthday.eligibleRoles.includes(role.id))) return;
  const channel = await guildChannel(guild, vip ? settings.channels.birthdayVip : settings.channels.birthdayStandard);
  if (!channel) return;
  const user = member.user;
  const embed = new EmbedBuilder().setTitle('🎉 Happy Birthday!').setColor(0x1f8b4c)
    .setDescription(`The mod team wishes you a very warm birthday! 🎂\nWe hope everything goes well from today onwards.\nOn this day, you are **${birthdayAge(birthday.Date, birthday.Timezone || 0)} years old**!`)
    .setThumbnail(user.displayAvatarURL()).setFooter({ text: settings.brand || guild.name, iconURL: guild.iconURL() }).setTimestamp();
  const claimed = await Birthday.findOneAndUpdate({ _id: birthday._id, GuildID: guild.id, LastWished: { $ne: key } }, { $set: { LastWished: key } }, { new: true });
  if (!claimed) return;
  try { await channel.send({ content: `<@${birthday.UserID}>`, embeds: [embed] }); }
  catch (error) {
    await Birthday.updateOne({ _id: birthday._id, GuildID: guild.id, LastWished: key }, { $set: { LastWished: birthday.LastWished || '' } });
    throw error;
  }
}
module.exports.processBirthday = processBirthday;
