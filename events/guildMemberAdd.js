const { assignRolesToMember } = require("../utilities/functions");

module.exports = {
  name: "guildMemberAdd",
  once: false,

  async execute(member) {
    // Small delay to allow Discord to finish populating the member object
    setTimeout(async () => {
      try {
        await assignRolesToMember(member);
      } catch (error) {
        console.error(`[GuildMemberAdd] Failed to assign roles to ${member.user.tag}:`, error);
      }
    }, 5_000);
  },
};
