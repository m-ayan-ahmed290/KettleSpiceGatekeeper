const { Client, ChatInputCommandInteraction, ButtonInteraction } = require('discord.js');
function fixture(name, options = []) {
  const client = new Client({ intents: [] }), requests = [];
  const bot = { id: '100000000000000001', username: 'Gatekeeper', discriminator: '0', avatar: null, bot: true };
  const user = { id: '200000000000000001', username: 'Alice', discriminator: '0', avatar: null };
  client.user = client.users._add(bot);
  const guild = client.guilds._add({ id: '300000000000000001', name: 'Test server', roles: [], emojis: [], features: [] });
  const interaction = new ChatInputCommandInteraction(client, {
    id: '600000000000000001', application_id: bot.id, token: 'offline-fixture', version: 1, type: 2,
    guild_id: guild.id, channel_id: '400000000000000001', entitlements: [], authorizing_integration_owners: {},
    member: { user, roles: [], permissions: '8' },
    data: { id: '700000000000000001', name, type: 1, options },
  });
  const message = raw => { const body = raw.data || raw; return ({ id: '500000000000000001', channel_id: interaction.channelId, author: bot,
    content: body.content || '', timestamp: new Date().toISOString(), edited_timestamp: null,
    tts: false, mention_everyone: false, mentions: [], mention_roles: [], attachments: [], embeds: body.embeds || [],
    components: body.components || [], type: 0, flags: interaction.ephemeral ? 64 : 0, pinned: false }); };
  client.rest.post = async (route, options) => { requests.push({ method: 'POST', route, body: options.body }); return {}; };
  client.rest.patch = async (route, options) => { requests.push({ method: 'PATCH', route, body: options.body }); return message(options.body); };
  client.rest.get = async route => { requests.push({ method: 'GET', route }); return message(requests.filter(r => r.body).at(-1)?.body || {}); };
  const button = (customId, actor = user) => new ButtonInteraction(client, {
    id: '600000000000000002', application_id: bot.id, token: 'offline-button', version: 1, type: 3,
    guild_id: guild.id, channel_id: interaction.channelId, entitlements: [], authorizing_integration_owners: {},
    member: { user: actor, roles: [], permissions: '8' }, data: { custom_id: customId, component_type: 2 },
    message: message(requests.filter(r => r.body).at(-1)?.body || {}),
  });
  return { client, interaction, requests, guild, user, button };
}
module.exports = { fixture };
