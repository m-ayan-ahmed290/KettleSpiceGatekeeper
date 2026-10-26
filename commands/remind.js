const { SlashCommandBuilder } = require("discord.js");
const Reminder = require("../schemas/reminder");
const { createReminder } = require("../utilities/reminders");
module.exports = {
  data: new SlashCommandBuilder().setName("remind").setDescription("Manage personal reminders delivered by DM, even after a restart.")
    .addSubcommand(s => s.setName("set").setDescription("Create a reminder (up to 10 pending per person).")
      .addStringOption(o => o.setName("when").setDescription("1m–365d, e.g. 30m, 2h or 7d.").setRequired(true).setMaxLength(12))
      .addStringOption(o => o.setName("text").setDescription("What to remind you about.").setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s.setName("list").setDescription("List your reminders in this server, including failed deliveries."))
    .addSubcommand(s => s.setName("cancel").setDescription("Cancel one of your reminders.")
      .addStringOption(o => o.setName("id").setDescription("Reminder ID from /remind list.").setRequired(true).setMaxLength(24))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const query = { UserID: interaction.user.id, GuildID: interaction.guild.id };
    const sub = interaction.options.getSubcommand();
    if (sub === "set") {
      let reminder;
      try {
        reminder = await createReminder({ userId: query.UserID, guildId: query.GuildID,
          text: interaction.options.getString("text"), duration: interaction.options.getString("when") });
      } catch (error) {
        if (error.name !== "Error") throw error;
        // Validation errors are safe to display; database driver errors are handled centrally.
        if (!/^(Use a duration|Reminder text|A reminder|You already)/.test(error.message)) throw error;
        return interaction.editReply({ content: error.message });
      }
      return interaction.editReply({ content: `✅ I'll DM you <t:${Math.floor(reminder.DueAt.getTime() / 1000)}:R>.\nID: ${reminder._id}\nAllow DMs from server members. Delivery normally occurs within a minute; restarts and backlogs can delay it.` });
    }
    if (sub === "cancel") {
      const id = interaction.options.getString("id");
      if (!/^[a-f0-9]{24}$/i.test(id)) return interaction.editReply({ content: "Use an ID from /remind list." });
      const removed = await Reminder.findOneAndDelete({ ...query, _id: id });
      return interaction.editReply({ content: removed ? "✅ Reminder cancelled. If delivery already started, a DM may still arrive." : "No reminder found for you in this server." });
    }
    const reminders = await Reminder.find(query).sort({ DueAt: 1 }).limit(10).lean();
    return interaction.editReply({ content: reminders.length ? reminders.map(r =>
      `${r._id} · ${r.Status === "failed" ? "Delivery failed (check DM settings)" : `<t:${Math.floor(new Date(r.DueAt).getTime() / 1000)}:R>`}\n${r.Text.slice(0, 100)}`
    ).join("\n\n").slice(0, 1950) : "You have no reminders in this server.", allowedMentions: { parse: [] } });
  },
};
