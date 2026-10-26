/**
 * interactionCreate.js — Handles slash command dispatching and logs executions.
 */

const { MessageEmbed } = require("discord.js");
const chalk = require("chalk");
const { modChId } = require("../config.json");
const client = require("../utilities/client");

module.exports = {
  name: "interactionCreate",
  once: false,

  async execute(interaction) {
    if (!interaction.isCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Resolve subcommand and options for logging
    const optionsData = interaction.options?.data ?? [];
    let subcommandName = null;
    let subcommandOptions = [];

    if (optionsData.length > 0 && optionsData[0].type === 1) {
      subcommandName = optionsData[0].name;
      subcommandOptions = optionsData[0].options ?? [];
    }

    // Fetch the log channel once before executing the command
    let logChannel = null;
    try {
      logChannel = await interaction.client.channels.fetch(modChId);
    } catch (e) {
      console.warn(chalk.yellow("[InteractionCreate] Could not fetch log channel:"), e.message);
    }

    // Execute the command
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(chalk.red.bold("[InteractionCreate] Command error:"), error);

      const errorPayload = {
        content: "⚠️ There was an error while executing this command!",
        ephemeral: true,
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload);
        } else {
          await interaction.reply(errorPayload);
        }
      } catch (replyErr) {
        console.error(chalk.red("[InteractionCreate] Failed to send error reply:"), replyErr);
      }
      return; // Don't log failed commands
    }

    // Log successful command execution
    console.log(
      chalk.greenBright.bold("✅ Command:"),
      chalk.cyanBright(`/${interaction.commandName}`),
      subcommandName ? chalk.cyanBright(`(${subcommandName})`) : "",
      chalk.yellow(`by ${interaction.user.tag}`),
      chalk.magenta(`in #${interaction.channel?.name ?? "unknown"}`),
      chalk.gray(`(${interaction.guild?.name ?? "DM"})`)
    );

    if (!logChannel) return;

    // Build log embed
    const fields = [];
    if (subcommandName) {
      fields.push({ name: "🔹 Subcommand", value: `\`${subcommandName}\``, inline: false });
    }

    const optList = subcommandName ? subcommandOptions : optionsData;
    if (optList.length > 0) {
      fields.push({
        name: "📝 Options",
        value: optList
          .map((o) => `> **${o.name}:** ${o.value ?? "*(none)*"}`)
          .join("\n"),
      });
    }

    const embed = new MessageEmbed()
      .setColor("#00e676")
      .setTitle(`✨ /${interaction.commandName.toUpperCase()} Executed`)
      .setDescription(
        `🧑‍💻 **User:** ${interaction.user}\n` +
        `🌐 **Server:** ${interaction.guild?.name ?? "DM"}\n` +
        `💬 **Channel:** <#${interaction.channel?.id}>`
      )
      .addFields(...fields)
      .setFooter({
        text: "Command Logger",
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (logErr) {
      console.warn("[InteractionCreate] Failed to send log embed:", logErr.message);
    }
  },
};
