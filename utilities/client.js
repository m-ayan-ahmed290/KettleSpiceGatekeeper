const { Client, GatewayIntentBits, Partials, Options } = require("discord.js");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildModeration],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings,
    MessageManager: 25,
    GuildMemberManager: { maxSize: 100, keepOverLimit: member => member.id === member.client.user?.id },
    UserManager: { maxSize: 200, keepOverLimit: user => user.id === user.client.user?.id },
    PresenceManager: 0,
  }),
  sweepers: { messages: { interval: 300, lifetime: 600 } },
  allowedMentions: { parse: ["users"], repliedUser: false },
  rest: { retries: 1, timeout: 15_000 },
});
module.exports = client;
