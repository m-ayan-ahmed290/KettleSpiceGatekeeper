const { SlashCommandBuilder } = require("@discordjs/builders");
const { Permissions } = require("discord.js");
const BlockWords = require("../schemas/blockWordsSchema");
const { invalidate } = require("../utilities/blockedWords");
module.exports = {
  data: new SlashCommandBuilder().setName("block-words").setDescription("Manage the moderation word and phrase blocklist.")
    .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_MESSAGES)
    .addSubcommand(s => s.setName("add").setDescription("Block a word or phrase.")
      .addStringOption(o => o.setName("word").setDescription("Word or phrase to block.").setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a word or phrase.")
      .addStringOption(o => o.setName("word").setDescription("Word or phrase to remove.").setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName("list").setDescription("List blocked words and phrases.")
      .addIntegerOption(o => o.setName("page").setDescription("Page number (20 entries per page).").setMinValue(1).setMaxValue(500))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === "list") {
      const page = interaction.options.getInteger("page") || 1;
      const words = await BlockWords.find().select("BlockWord -_id").sort({ BlockWord: 1 }).skip((page - 1) * 20).limit(20).lean();
      return interaction.editReply({ content: words.length ? `Blocked words — page ${page}\n` + words.map(w => w.BlockWord).join("\n").slice(0, 1800) : "No blocked words on this page.", allowedMentions: { parse: [] } });
    }
    const word = interaction.options.getString("word").trim().toLowerCase();
    if (!word) return interaction.editReply({ content: "Enter a nonempty word or phrase." });
    let content;
    if (sub === "add") {
      if (await BlockWords.exists({ BlockWord: word })) content = "That word is already blocked.";
      else { await BlockWords.create({ BlockWord: word }); content = "✅ Word or phrase blocked."; }
    } else {
      const result = await BlockWords.deleteOne({ BlockWord: word });
      content = result.deletedCount ? "✅ Word or phrase removed." : "That word is not blocked.";
    }
    invalidate();
    return interaction.editReply({ content });
  },
};
