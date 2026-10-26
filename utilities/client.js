const { Client, Intents, Options } = require("discord.js");

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_BANS, // Required for ban/timeout audit log events
  ],
  partials: ["MESSAGE", "CHANNEL", "REACTION", "USER"],
  makeCache: Options.cacheWithLimits({
    ...Options.defaultMakeCacheSettings,
    MessageManager: 50,
    GuildMemberManager: { maxSize: 200, keepOverLimit: member => member.id === member.client.user?.id },
    UserManager: { maxSize: 300, keepOverLimit: user => user.id === user.client.user?.id },
    PresenceManager: 0,
  }),
  sweepers: { messages: { interval: 300, lifetime: 600 } },
  allowedMentions: { parse: ["users"], repliedUser: false },
  // Automatically retry failed requests up to 1 time
  retryLimit: 1,
});

module.exports = client;
