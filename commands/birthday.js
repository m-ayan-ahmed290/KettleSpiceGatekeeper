/**
 * birthday.js — Set, update, or remove your birthday.
 *
 * Validations:
 *  - Format must be YYYY-MM-DD
 *  - Year must be between 1980 and the current year (inclusive)
 *  - Date must be a real calendar date (e.g. not Feb 30)
 *  - Date cannot be in the future
 *  - Must be at least 1 year old
 */

const Birthday = require("../schemas/birthdays");
const { vipBDCh, plebBDCh } = require("../config.json");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");

const MIN_YEAR = 1980;

/** Roles that qualify a member for the VIP birthday channel. */
const VIP_ROLE_NAMES = new Set(["Moderator", "Basement Dwellers"]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Set or remove your birthday.")
    .addStringOption((opt) =>
      opt
        .setName("date")
        .setDescription('Your birth date (YYYY-MM-DD). Type "0" to remove your birthday.')
        .setRequired(false)
    )
    .addNumberOption((opt) =>
      opt
        .setName("timezone")
        .setDescription("Your UTC timezone offset (e.g. -5, 0, 5).")
        .setRequired(false)
        .setMinValue(-12)
        .setMaxValue(14)
    ),

  async execute(interaction) {
    const dateInput = interaction.options.getString("date")?.trim();
    if (!dateInput) {
      const saved = await Birthday.findOne({ UserID: interaction.user.id }).lean();
      return interaction.reply({ content: saved ? `Your birthday is ${new Date(saved.Date).toISOString().slice(0, 10)} (UTC${saved.Timezone >= 0 ? "+" : ""}${saved.Timezone}).` : "You have no birthday set. Use /birthday date:YYYY-MM-DD timezone:0.", ephemeral: true });
    }
    const timezone = interaction.options.getNumber("timezone") ?? 0;
    const user = interaction.user;

    try {
      // ── Remove birthday ───────────────────────────────────────────────────
      if (dateInput === "0") {
        const deleted = await Birthday.findOneAndDelete({ UserID: user.id });
        return interaction.reply({
          content: deleted
            ? "✅ Your birthday has been removed."
            : "ℹ️ You don't have a birthday set.",
          ephemeral: true,
        });
      }

      // ── Format check ──────────────────────────────────────────────────────
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return interaction.reply({
          content: "❌ Invalid format. Please use **YYYY-MM-DD** (e.g. `1999-07-25`).",
          ephemeral: true,
        });
      }

      const [yearStr, monthStr, dayStr] = dateInput.split("-");
      const year  = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day   = parseInt(dayStr, 10);
      const currentYear = new Date().getUTCFullYear();

      // ── Year range ────────────────────────────────────────────────────────
      if (year < MIN_YEAR || year > currentYear) {
        return interaction.reply({
          content: `❌ Year must be between **${MIN_YEAR}** and **${currentYear}**.`,
          ephemeral: true,
        });
      }

      // ── Real calendar date check ──────────────────────────────────────────
      const birthDate = new Date(Date.UTC(year, month - 1, day));
      if (
        isNaN(birthDate.getTime()) ||
        birthDate.getUTCFullYear() !== year ||
        birthDate.getUTCMonth()   !== month - 1 ||
        birthDate.getUTCDate()    !== day
      ) {
        return interaction.reply({
          content: "❌ That date doesn't exist on the calendar. Please double-check it.",
          ephemeral: true,
        });
      }

      // ── Not in the future ─────────────────────────────────────────────────
      const now = new Date();
      if (birthDate > now) {
        return interaction.reply({
          content: "❌ Your birthday can't be in the future.",
          ephemeral: true,
        });
      }

      // ── Must be at least 1 year old ───────────────────────────────────────
      const age = calcAge(birthDate);
      if (age < 1) {
        return interaction.reply({
          content: "❌ You must be at least 1 year old to set a birthday.",
          ephemeral: true,
        });
      }

      // ── Determine VIP status ──────────────────────────────────────────────
      const hasRole = interaction.member.roles.cache.some((r) =>
        VIP_ROLE_NAMES.has(r.name)
      );

      // ── Upsert birthday ───────────────────────────────────────────────────
      await Birthday.findOneAndUpdate(
        { UserID: user.id },
        {
          Username: user.username,
          UserID:   user.id,
          GuildID:  interaction.guild.id,
          Date:     birthDate,
          HasRole:  hasRole,
          Timezone: timezone,
        },
        { upsert: true, new: true }
      );

      await interaction.reply({
        content: `✅ Birthday set to **${dateInput}** (UTC${timezone >= 0 ? "+" : ""}${timezone}).`,
        ephemeral: true,
      });

      const saved = await Birthday.findOne({ UserID: user.id }).lean();
      await require("../events/ready").processBirthday(interaction.client, saved);
    } catch (error) {
      console.error("[Birthday Command] Error:", error);
      const errPayload = {
        content: "⚠️ There was an error setting your birthday. Please try again later.",
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errPayload);
      } else {
        await interaction.reply(errPayload);
      }
    }
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function calcAge(birthDate) {
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}
