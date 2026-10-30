/**
 * interactionCreate.js — Handles slash command dispatching and logs executions.
 */

const { enterCommand } = require("../utilities/commandGuard");
const { runCommand } = require("../utilities/runCommand");
const { EmbedBuilder } = require("discord.js");
const chalk = require("chalk");
const { getGuildSettings, guildChannel } = require("../utilities/guildSettings");
const client = require("../utilities/client");

module.exports = {
  name: "interactionCreate",
  once: false,

  async execute(interaction) {
    if (interaction.isMessageComponent?.() && interaction.customId?.startsWith('game:'))
      return require('../utilities/gameRuntime').handleGameInteraction(interaction);
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    if (interaction.client.dataReady === false && !["ping", "help", "serverinfo"].includes(interaction.commandName))
      return interaction.reply({ content: "The database is initializing. Try again shortly.", ephemeral: true });
    // Resolve subcommand and options for logging
    const optionsData = interaction.options?.data ?? [];
    let subcommandName = null;
    let subcommandOptions = [];

    if (optionsData.length > 0 && optionsData[0].type === 1) {
      subcommandName = optionsData[0].name;
      subcommandOptions = optionsData[0].options ?? [];
    }

    if (!interaction.guild) {
      return interaction.reply({ content: "Use this command in a server.", ephemeral: true });
    }
    const required = command.data.toJSON().default_member_permissions;
    if (required && !interaction.memberPermissions?.has(BigInt(required))) {
      return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
    }

    const slot = enterCommand(interaction.user.id);
    if (slot.error) return interaction.reply({ content: slot.error, ephemeral: true });

    // Execute the command
    try {
      await runCommand(command, interaction);
    } catch (error) {
      console.error(chalk.red.bold("[InteractionCreate] Command error:"), error);

      const errorPayload = {
        content: "⚠️ There was an error while executing this command!",
        ephemeral: true,
      };

      try {
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: errorPayload.content, components: [], embeds: [] });
        } else if (interaction.replied) {
          await interaction.followUp(errorPayload);
        } else {
          await interaction.reply(errorPayload);
        }
      } catch (replyErr) {
        console.error(chalk.red("[InteractionCreate] Failed to send error reply:"), replyErr);
      }
      return; // Don't log failed commands
    } finally { slot.release(); }

    if (interaction.commandName === "remind") return;

    // Log successful command execution
    console.log(
      chalk.greenBright.bold("✅ Command:"),
      chalk.cyanBright(`/${interaction.commandName}`),
      subcommandName ? chalk.cyanBright(`(${subcommandName})`) : "",
      chalk.yellow(`by ${interaction.user.tag}`),
      chalk.magenta(`in #${interaction.channel?.name ?? "unknown"}`),
      chalk.gray(`(${interaction.guild?.name ?? "DM"})`)
    );

    const settings = await getGuildSettings(interaction.guild.id);
    const logChannel = await guildChannel(interaction.guild, settings.channels.moderation);
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
          .join("\n").slice(0, 1024),
      });
    }

    const embed = new EmbedBuilder()
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
