/**
 * functions.js — Role management utilities.
 *
 * Handles assigning / removing tiered auto-roles based on a member's
 * subscription roles (Twitch tiers, YouTube members, etc.).
 */

const { roles, TRoles } = require("../data/roles.json");
const { guildId2 } = require("../config.json");
const client = require("./client");

const LOG_CHANNEL_ID = "1105487618189295686";
const ROLE_ACTION_DELAY_MS = 1_000;

// ─── Channel helper ───────────────────────────────────────────────────────────

let cachedLogChannel = null;

async function getLogChannel() {
  if (!cachedLogChannel) {
    cachedLogChannel = await client.channels.fetch(LOG_CHANNEL_ID);
  }
  return cachedLogChannel;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assigns missing tier auto-roles to every member in guildId2.
 */
function assignRolesToAllMembers() {
  const guild = client.guilds.cache.get(guildId2);
  if (!guild) {
    console.warn("[Functions] assignRolesToAllMembers: guild not found.");
    return;
  }

  guild.members
    .fetch()
    .then((members) =>
      Promise.all(members.map((member) => assignRolesToMember(member)))
    )
    .catch((err) => console.error("[Functions] Error fetching members:", err));
}

/**
 * Assigns any missing tier auto-roles to a single member.
 * @param {import('discord.js').GuildMember} member
 */
async function assignRolesToMember(member) {
  const roleNames = member.roles.cache.map((r) => r.name);

  const hasTier1 = roles.T1.some((r) => roleNames.includes(r));
  const hasTier2 = roles.T2.some((r) => roleNames.includes(r));
  const hasTier3 = roleNames.includes(roles.T3);

  const hasTR1 = roleNames.includes(TRoles.TR1);
  const hasTR2 = roleNames.includes(TRoles.TR2);
  const hasTR3 = roleNames.includes(TRoles.TR3);

  if (hasTier1 && !hasTR1) await assignRole(member, TRoles.TR1);
  if (hasTier2 && !hasTR2) await assignRole(member, TRoles.TR2);
  if (hasTier3 && !hasTR3) await assignRole(member, TRoles.TR3);
}

/**
 * Checks a member's current roles and assigns or removes tier auto-roles.
 * Called on guildMemberUpdate.
 * @param {import('discord.js').GuildMember} member
 */
async function checkRolesAndUpdate(member) {
  const roleNames = member.roles.cache.map((r) => r.name);

  const hasTier1 = roles.T1.some((r) => roleNames.includes(r));
  const hasTier2 = roles.T2.some((r) => roleNames.includes(r));
  const hasTier3 = roleNames.includes(roles.T3);

  const tier1Role = findRole(member.guild, TRoles.TR1);
  const tier2Role = findRole(member.guild, TRoles.TR2);
  const tier3Role = findRole(member.guild, TRoles.TR3);

  await assignOrRemoveRole(member, tier1Role, hasTier1 ? "assign" : "remove");
  await assignOrRemoveRole(member, tier2Role, hasTier2 ? "assign" : "remove");
  await assignOrRemoveRole(member, tier3Role, hasTier3 ? "assign" : "remove");
}

/**
 * Removes all tier auto-roles from every member (utility / maintenance function).
 */
async function removeAllRolesFromMembers() {
  const guild = client.guilds.cache.get(guildId2);
  if (!guild) return;

  const tier1Role = findRole(guild, TRoles.TR1);
  const tier2Role = findRole(guild, TRoles.TR2);
  const tier3Role = findRole(guild, TRoles.TR3);

  const members = await guild.members.fetch();

  for (const member of members.values()) {
    try {
      if (tier1Role && member.roles.cache.has(tier1Role.id))
        await member.roles.remove(tier1Role);
      if (tier2Role && member.roles.cache.has(tier2Role.id))
        await member.roles.remove(tier2Role);
      if (tier3Role && member.roles.cache.has(tier3Role.id))
        await member.roles.remove(tier3Role);

      console.log(`[Functions] Removed tier roles from ${member.user.tag}`);
    } catch (err) {
      console.error(`[Functions] Failed to remove roles from ${member.user.tag}:`, err);
    }
  }
}

module.exports = {
  assignRolesToAllMembers,
  assignRolesToMember,
  checkRolesAndUpdate,
  removeAllRolesFromMembers,
};

// ─── Private helpers ──────────────────────────────────────────────────────────

function findRole(guild, roleName) {
  return guild.roles.cache.find((r) => r.name === roleName) ?? null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assignRole(member, roleName) {
  const role = findRole(member.guild, roleName);
  if (!role) return;

  try {
    await member.roles.add(role);
    console.log(`[Functions] Assigned "${role.name}" to ${member.user.tag}`);
    const ch = await getLogChannel();
    await ch.send(`✅ Assigned **${role.name}** to ${member.user.tag}`);
  } catch (err) {
    console.error(`[Functions] Failed to add "${roleName}" to ${member.user.tag}:`, err);
  }
}

async function assignOrRemoveRole(member, role, action) {
  if (!role) return;

  const hasRole = member.roles.cache.has(role.id);

  if (action === "assign" && !hasRole) {
    try {
      await member.roles.add(role);
      console.log(`[Functions] Assigned "${role.name}" to ${member.user.tag}`);
      const ch = await getLogChannel();
      await ch.send(`✅ Assigned **${role.name}** to ${member.user.tag}`);
    } catch (err) {
      console.error(`[Functions] Error assigning "${role.name}" to ${member.user.tag}:`, err);
    }
    await delay(ROLE_ACTION_DELAY_MS);
  } else if (action === "remove" && hasRole) {
    try {
      await member.roles.remove(role);
      console.log(`[Functions] Removed "${role.name}" from ${member.user.tag}`);
      const ch = await getLogChannel();
      await ch.send(`🗑️ Removed **${role.name}** from ${member.user.tag}`);
    } catch (err) {
      console.error(`[Functions] Error removing "${role.name}" from ${member.user.tag}:`, err);
    }
    await delay(ROLE_ACTION_DELAY_MS);
  }
}
