/**
 * ping.js — Bot health stats: latency, uptime, memory, attachment cache size.
 */

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
const { cacheSize } = require("../utilities/attachmentCache");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot health: latency, uptime, memory usage."),

  async execute(interaction) {
    try {
      const wsLatency          = interaction.client.ws.ping;
      const interactionLatency = Date.now() - interaction.createdTimestamp;
      const uptimeMs           = interaction.client.uptime ?? 0;
      const mem                = process.memoryUsage();

      const embed = new MessageEmbed()
        .setTitle("🏓 Pong!")
        .setColor("#00e5ff")
        .addFields(
          { name: "🌐 WebSocket Latency", value: `${wsLatency}ms`,            inline: true },
          { name: "⚡ Interaction Latency", value: `${interactionLatency}ms`, inline: true },
          { name: "⏱️ Uptime",            value: formatUptime(uptimeMs),     inline: true },
          { name: "🧠 Heap Used",         value: `${mb(mem.heapUsed)} MB`,   inline: true },
          { name: "💾 RSS",               value: `${mb(mem.rss)} MB`,        inline: true },
          { name: "📦 Cached Msgs",       value: `${cacheSize()}`,           inline: true },
        )
        .setThumbnail(interaction.user.avatarURL({ dynamic: true }))
        .setFooter({
          text: "Kettle's Tea Garden",
          iconURL: interaction.guild.iconURL({ dynamic: true }),
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("[Ping] Error:", error);
      await interaction.reply({ content: "⚠️ Failed to fetch stats.", ephemeral: true });
    }
  },
};

function mb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}

function formatUptime(ms) {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s  / 60);
  const h  = Math.floor(m  / 60);
  const d  = Math.floor(h  / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
