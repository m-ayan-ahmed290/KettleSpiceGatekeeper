const { getGuildSettings, guildChannel } = require('./guildSettings');
const roleJobs = new Map();
function findRole(guild, reference) { return guild.roles.cache.get(reference) || guild.roles.cache.find(role => role.name === reference); }
async function updateMemberRoles(member, remove = false) {
  const settings = await getGuildSettings(member.guild.id);
  if (!settings.features.roles || member.user.bot) return;
  for (const rule of settings.roles) {
    const target = findRole(member.guild, rule.target);
    if (!target) continue;
    const qualifies = rule.sources.some(source => member.roles.cache.some(role => role.id === source || role.name === source));
    const has = member.roles.cache.has(target.id);
    if (qualifies === has || (!qualifies && !remove)) continue;
    try {
      if (qualifies) await member.roles.add(target, 'Automatic role rule');
      else await member.roles.remove(target, 'Automatic role rule');
      const channel = await guildChannel(member.guild, settings.channels.status);
      if (channel) await channel.send({ content: `${qualifies ? '✅ Assigned' : '🗑️ Removed'} **${target.name}** ${qualifies ? 'to' : 'from'} ${member.user.tag}`, allowedMentions: { parse: [] } });
    } catch (error) { console.warn(`[Roles:${member.guild.id}] ${error.message}`); }
  }
}
async function* paginatedMembers(guild) {
  let after;
  while (true) {
    const page = await guild.members.list({ limit: 100, after, cache: false });
    yield* page.values();
    if (page.size < 100) return;
    after = page.last().id;
  }
}
function assignRolesToAllMembers(guild) {
  if (!guild?.id) return Promise.reject(new Error('A guild is required for role refresh'));
  if (roleJobs.has(guild.id)) return roleJobs.get(guild.id);
  const job = (async () => {
    const settings = await getGuildSettings(guild.id);
    if (!settings.features.roles || !settings.roles.length) return;
    for await (const member of paginatedMembers(guild)) await updateMemberRoles(member);
  })().finally(() => roleJobs.delete(guild.id));
  roleJobs.set(guild.id, job); return job;
}
async function removeAllRolesFromMembers(guild) {
  if (!guild?.id) throw new Error('A guild is required');
  const settings = await getGuildSettings(guild.id);
  for await (const member of paginatedMembers(guild)) {
    for (const rule of settings.roles) {
      const target = findRole(guild, rule.target);
      if (target && member.roles.cache.has(target.id)) await member.roles.remove(target);
    }
  }
}
module.exports = { assignRolesToAllMembers, assignRolesToMember: member => updateMemberRoles(member),
  checkRolesAndUpdate: member => updateMemberRoles(member, true), removeAllRolesFromMembers, findRole };
