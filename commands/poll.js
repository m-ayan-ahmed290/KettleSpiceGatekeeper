const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣"];
module.exports = {
  data: new SlashCommandBuilder().setName("poll").setDescription("Create a multiple-choice reaction poll.")
    .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_MESSAGES)
    .addStringOption(o => o.setName("question").setDescription("Poll question.").setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName("choices").setDescription("2–6 choices separated by |, e.g. Tea | Coffee.").setRequired(true).setMaxLength(500)),
  async execute(interaction) {
    const question = interaction.options.getString("question").trim();
    const choices = interaction.options.getString("choices").split("|").map(s => s.trim());
    if (!question || choices.length < 2 || choices.length > 6 || choices.some(s => !s || s.length > 80) || new Set(choices.map(s => s.toLowerCase())).size !== choices.length)
      return interaction.reply({ content: "Provide a question and 2–6 different, nonempty choices (up to 80 characters each), separated by |.", ephemeral: true });
    const permissions = interaction.channel.permissionsFor(interaction.guild.me);
    if (!permissions?.has([Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.EMBED_LINKS, Permissions.FLAGS.ADD_REACTIONS, Permissions.FLAGS.READ_MESSAGE_HISTORY]))
      return interaction.reply({ content: "I need Send Messages, Embed Links, Add Reactions and Read Message History here.", ephemeral: true });
    const embed = new MessageEmbed().setTitle(question).setColor("BLURPLE")
      .setDescription(choices.map((choice, i) => `${emojis[i]} ${choice}`).join("\n"))
      .setFooter({ text: `By ${interaction.user.username} • Multiple choices allowed • Subtract the bot's seed reaction from totals` });
    const message = await interaction.reply({ embeds: [embed], fetchReply: true, allowedMentions: { parse: [] } });
    for (let i = 0; i < choices.length; i++) {
      try { await message.react(emojis[i]); }
      catch (error) {
        console.warn("[Poll] Could not seed reactions:", error.message);
        await interaction.followUp({ content: "Poll posted, but some reactions could not be added. Check my channel permissions.", ephemeral: true });
        break;
      }
    }
  },
};
