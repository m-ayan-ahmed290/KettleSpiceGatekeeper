const { checkRolesAndUpdate } = require("../utilities/functions");

module.exports = {
  name: "guildMemberUpdate",
  once: false,

  async execute(oldMember, newMember) {
    try {
      if (oldMember.roles.cache.equals(newMember.roles.cache)) return;
      await checkRolesAndUpdate(newMember);
    } catch (error) {
      console.error(`[GuildMemberUpdate] Failed for ${newMember.user.tag}:`, error);
    }
  },
};
