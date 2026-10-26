const { SlashCommandBuilder } = require(`@discordjs/builders`);
const { emoji } = require(`../data/emojis.json`);
const { Permissions } = require("discord.js");
const creditSchema = require(`../schemas/credits`);

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`manage-mod`)
    .setDescription(`Block/Unblock a moderator from gaining credits.`)
    .addSubcommand((sub) =>
      sub
        .setName(`block`)
        .setDescription(`Block a moderator from gaining credits.`)
        .addUserOption((opt) =>
          opt
            .setName(`moderator`)
            .setDescription(`The moderator to be managed.`)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName(`reason`)
            .setDescription(
              `Reason for blocking the moderator from gaining credits.`
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(`unblock`)
        .setDescription(`Unblock a moderator from their credit-block.`)
        .addUserOption((opt) =>
          opt
            .setName(`moderator`)
            .setDescription(`The moderator to be managed.`)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName(`credits`)
        .setDescription(`Manage the credits for a moderator.`)
        .addUserOption((opt) =>
          opt
            .setName(`moderator`)
            .setDescription(`The moderator to be managed`)
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName(`amount`)
            .setDescription(
              `The credits amount to set/increase/decrease a moderator's credits.`
            )
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName(`action`)
            .setDescription(
              `Choose whether to increase/decrease or set moderator's credits.`
            )
            .addChoices(
              { name: `Increase`, value: `increase` },
              { name: `Decrease`, value: `decrease` },
              { name: `Set`, value: `set` }
            )
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName(`reason`)
            .setDescription(`Provide a reason for managing credits.`)
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(Permissions.FLAGS.BAN_MEMBERS),

  async execute(interaction) {
    if (interaction.user.id !== `648146589814095893`) {
      return interaction.reply({
        content: `${emoji.failure} You do not have permission to use this command`,
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const moderator = interaction.options.getUser(`moderator`);
    const modId = moderator.id;
    const creditUser = await creditSchema.findOne({ UserID: modId });

    if (!creditUser) {
      return interaction.reply({
        content: `${emoji.failure} This user does not exist in the database!`,
        ephemeral: true,
      });
    }

    if (subcommand === `block`) {
      const reason = interaction.options.getString(`reason`);
      await creditSchema.updateOne(
        { UserID: modId },
        { $set: { Blocked: true, Reason: reason } }
      );
      return interaction.reply({
        content: `${emoji.success} ${moderator.username} has been blocked from gaining credits.`,
        ephemeral: true,
      });
    }

    if (subcommand === `unblock`) {
      if (!creditUser.Blocked) {
        return interaction.reply({
          content: `${emoji.failure} ${moderator.username} is not credit-blocked!`,
          ephemeral: true,
        });
      }
      await creditSchema.updateOne(
        { UserID: modId },
        { $set: { Blocked: false, Reason: "" } }
      );
      return interaction.reply({
        content: `${emoji.success} ${moderator.username} has been unblocked from their credit-block!`,
        ephemeral: true,
      });
    }

    if (subcommand === `credits`) {
      try {
        const { amount, action, reason } = {
          amount: interaction.options.getInteger(`amount`),
          action: interaction.options.getString(`action`),
          reason: interaction.options.getString(`reason`),
        };

        let updatedCredits = creditUser.Credits;
        let act, opn;

        if (action === `increase`) {
          updatedCredits += amount;
          act = `MMC_INCREASE`;
          opn = `+`;
        } else if (action === `decrease`) {
          if (amount > updatedCredits) {
            return interaction.reply({
              content: `Cannot decrease the credits below 0!`,
              ephemeral: true,
            });
          }
          updatedCredits -= amount;
          act = `MMC_DECREASE`;
          opn = `-`;
        } else if (action === `set`) {
          updatedCredits = amount;
          act = `MMC_SET`;
          opn = `=`;
        } else {
          return interaction.reply({
            content: `Invalid action specified.`,
            ephemeral: true,
          });
        }

        const actReason = {
          Date: Date.now(),
          ActionReason: `${act} ${reason}`,
          Credit: `${opn}${amount}`,
        };

        await creditSchema.updateOne(
          { UserID: modId },
          { $set: { Credits: updatedCredits } }
        );
        creditUser.Action.push(actReason);
        await creditUser.save();

        return interaction.reply({
          content: `${emoji.success} Updated ${moderator.username}'s credits to ${updatedCredits}!`,
          ephemeral: true,
        });
      } catch (error) {
        console.error(`Error in subcommand >manage-mod credits.js\n`, error);
        return interaction.reply({
          content: `${emoji.failure} An error occurred while managing credits.`,
          ephemeral: true,
        });
      }
    }
  },
};
