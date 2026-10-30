/**
 * roles_management.js — Admin role management utilities.
 *
 * Fixes:
 *  - `user.roles.add(role)` — the User object has no .roles collection;
 *    the GuildMember does. Now fetches the member first.
 *  - refreshing all members can take time; now defers the reply first.
 */

const { SlashCommandBuilder } = require("discord.js");
const { PermissionsBitField } = require("discord.js");
const { assignRolesToAllMembers } = require("../utilities/functions");
const { emojiForGuild } = require("../utilities/emojis");



module.exports = {
  data: new SlashCommandBuilder()
    .setName("roles-management")
    .setDescription("Run role management scripts.")
    .addSubcommand((sub) =>
      sub
        .setName("refresh")
        .setDescription("Re-assign tier auto-roles for every member based on their current subs.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("assign")
        .setDescription("Manually assign a role to a member.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("The member to assign the role to.").setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("The role to assign.").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "assign") {
      const targetUser = interaction.options.getUser("user");
      const role       = interaction.options.getRole("role");
      if (role.managed || role.id === interaction.guild.id || role.guild.id !== interaction.guild.id)
        return interaction.reply({ content: 'Choose a regular role from this server, not an integration role or @everyone.', ephemeral: true });

      let member;
      try {
        member = await interaction.guild.members.fetch(targetUser.id);
      } catch {
        return interaction.reply({
          content: `${emojiForGuild(interaction.guild.id).failure} Could not find that member in this server.`,
          ephemeral: true,
        });
      }

      try {
        await member.roles.add(role);
        return interaction.reply({
          content: `${emojiForGuild(interaction.guild.id).success} Assigned **${role.name}** to **${member.user.tag}**.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error("[RolesManagement] Failed to assign role:", error);
        return interaction.reply({
          content: `${emojiForGuild(interaction.guild.id).failure} Failed to assign **${role.name}** — check my role hierarchy.`,
          ephemeral: true,
        });
      }
    }

    if (sub === "refresh") {
      // Defer because this can take several seconds for large servers
      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await assignRolesToAllMembers(interaction.guild);
        return interaction.editReply({
          content: result.skipped ? 'Automatic roles are disabled or have no rules. Configure them with /setup first.'
            : `Role refresh finished: checked ${result.processed} members, assigned ${result.assigned}, removed ${result.removed}, failed ${result.failed}.` + (result.failed ? ' Check my permissions and role hierarchy for the failed updates.' : ''),
        });
      } catch (error) {
        console.error("[RolesManagement] Refresh failed:", error);
        return interaction.editReply({
          content: `${emojiForGuild(interaction.guild.id).failure} Role refresh failed — check the console.`,
        });
      }
    }
  },
};
