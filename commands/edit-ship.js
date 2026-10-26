/**
 * edit-ship.js — Manually set the affinity score for an existing ship.
 *
 * Improvements:
 *  - Ship strength is now validated to be 0–100 before touching the DB.
 *  - Ship name lookup is case-insensitive (matches the lowercased names
 *    written by the improved ship.js).
 */

const { SlashCommandBuilder } = require("@discordjs/builders");
const { Permissions } = require("discord.js");
const shipSchema = require("../schemas/shipSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit-ship")
    .setDescription("Edit a ship's affinity score.")
    .setDefaultMemberPermissions(Permissions.FLAGS.BAN_MEMBERS)
    .addStringOption((opt) =>
      opt.setName("ship-name").setDescription("Ship name to edit (case-insensitive).").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("ship-str")
        .setDescription("New affinity score (0–100).")
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction) {
    const name    = interaction.options.getString("ship-name").toLowerCase().trim();
    const shipStr = interaction.options.getInteger("ship-str");

    try {
      const ship = await shipSchema.findOne({ ShipName: name });

      if (!ship) {
        return interaction.reply({
          content: `❌ No ship found with name \`${name}\`. Ship names are case-insensitive.`,
          ephemeral: true,
        });
      }

      const oldStr  = ship.ShipStr;
      ship.ShipStr  = shipStr;
      await ship.save();

      return interaction.reply({
        content:
          `✅ Updated **${ship.ShipName}**'s affinity from \`${oldStr}%\` → \`${shipStr}%\`.`,
      });
    } catch (err) {
      console.error("[EditShip] Error:", err);
      const errMsg = {
        content: `⚠️ An error occurred: \`${err.message}\``,
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errMsg);
      } else {
        await interaction.reply(errMsg);
      }
    }
  },
};
