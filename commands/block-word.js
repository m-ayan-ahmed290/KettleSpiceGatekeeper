const { SlashCommandBuilder } = require(`@discordjs/builders`);
const blockWords = require(`../schemas/blockWordsSchema`);
const {
  MessageEmbed,
  Permissions,
  MessageButton,
  MessageActionRow,
} = require(`discord.js`);
const { emoji } = require(`../data/emojis.json`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`block-words`)
    .setDescription(`Add new words or remove existing words from blocklist.`)
    .addSubcommand((subcommand) =>
      subcommand
        .setName(`add`)
        .setDescription(`Add new words to blocklist.`)
        .addStringOption((option) =>
          option
            .setName(`word`)
            .setDescription(`The word to be blocked.`)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName(`remove`)
        .setDescription(`Remove words from blocklist.`)
        .addStringOption((option) =>
          option
            .setName(`word`)
            .setDescription(`The word to be removed.`)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_MESSAGES),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      if (subcommand === `add`) {
        try {
          const word = interaction.options.getString(`word`).toLowerCase();

          const wordInDb = await blockWords.findOne({ BlockWord: word });
          if (wordInDb) {
            return await interaction.reply({
              content: `${emoji.failure} This word is already blocked!`,
              ephemeral: true,
            });
          } else {
            await blockWords.create({ BlockWord: word });
            return await interaction.reply({
              content: `${emoji.success} Successfully blocked this word!`,
            });
          }
        } catch (error) {
          console.error(
            `Encountered an error in block-word.js > add:\n`,
            error
          );
          if (interaction.isReplied) {
            await interaction.editReply({
              content: `${emoji.failure} Encountered an error while saving the block word!\n \`\`\`js\n${error}\`\`\``,
            });
          } else {
            await interaction.reply({
              content: `${emoji.failure} Encountered an error while saving the block word!\n \`\`\`js\n${error}\`\`\``,
            });
          }
        }
      }

      if (subcommand === `remove`) {
        try {
          const word = interaction.options.getString(`word`).toLowerCase();

          const wordInDb = await blockWords.findOne({ BlockWord: word });
          if (wordInDb) {
            await blockWords.deleteOne({ BlockWord: word });
            return await interaction.reply({
              content: `${emoji.success} Successfully removed this word from blocklist!`,
            });
          } else {
            return await interaction.reply({
              content: `${emoji.failure} This word doesn't exist in blocklist!`,
              ephemeral: true,
            });
          }
        } catch (error) {
          console.error(
            `Encountered an error in block-word.js > remove:\n`,
            error
          );
          if (interaction.isReplied) {
            await interaction.editReply({
              content: `${emoji.failure} Encountered an error while removing the blocked word!\n \`\`\`js\n${error}\`\`\``,
            });
          } else {
            await interaction.reply({
              content: `${emoji.failure} Encountered an error while removing the blocked word!\n \`\`\`js\n${error}\`\`\``,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Encountered an error in block-word.js:\n`, error);
    }
  },
};
