const { checkRolesAndUpdate } = require("../utilities/functions");

module.exports = {
  name: "guildMemberUpdate",
  once: false,

  async execute(oldMember, newMember) {
    try {
      await checkRolesAndUpdate(newMember);
    } catch (error) {
      console.error(`[GuildMemberUpdate] Failed for ${newMember.user.tag}:`, error);
    }
  },
};
