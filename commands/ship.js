/**
 * ship.js — Check ship compatibility between two people.
 *
 * Fixes:
 *  - Both branches of the error handler were identical — collapsed to one.
 *  - getPersons() was calling interaction.reply() inside a helper that returns
 *    an object, causing the reply to fire twice and the caller to crash on
 *    `person2` being undefined. Now returns early cleanly.
 *  - Ship names are now lowercased before DB lookup so "AliceBob" and
 *    "alicebob" don't produce two different affinity scores.
 */

const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed } = require("discord.js");
const { emoji } = require("../data/emojis.json");
const shipSchema = require("../schemas/shipSchema");

const BANNED_WORDS = [
  "cock","dick","penis","pussy","vagina","mf","motherfucker",
  "mother fucker","fucker","bitch","fuck","shit","dildo","ass",
  "seggs","segg","slut","whore","hoe","cum",
];

const BANNED_CHARACTERS = [
  "nahida","qiqi","diona","yao yao","klee","yaoyao","clara",
];

const SHIP_QUALITY_RANGES = [
  { min: 0,    max: 0,   quality: "Worst",       bars: 0   },
  { min: 1,    max: 12,  quality: "Worse",        bars: 1   },
  { min: 13,   max: 25,  quality: "Poor",         bars: 2   },
  { min: 26,   max: 37,  quality: "Bad",          bars: 3   },
  { min: 38,   max: 50,  quality: "Ok",           bars: 4   },
  { min: 51,   max: 62,  quality: "Average",      bars: 5   },
  { min: 63,   max: 75,  quality: "Good",         bars: 6   },
  { min: 76,   max: 87,  quality: "Pretty Good",  bars: 7   },
  { min: 88,   max: 99,  quality: "Awesome",      bars: 7.5 },
  { min: 100,  max: 100, quality: "Perfect",      bars: 8   },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Check compatibility between two people.")
    .addStringOption((o) =>
      o.setName("person1").setDescription("First person (username or @mention)").setRequired(false)
    )
    .addStringOption((o) =>
      o.setName("person2").setDescription("Second person (username or @mention)").setRequired(false)
    ),

  async execute(interaction) {
    try {
      // ── Resolve names ────────────────────────────────────────────────────
      const result = await this.resolvePersons(interaction);
      if (!result) return; // resolvePersons already replied with the error

      const { person1, person2 } = result;

      // ── Banned content check ─────────────────────────────────────────────
      const banned = checkBannedContent(person1, person2);
      if (banned.length > 0) {
        return interaction.reply({
          content: `❌ Can't ship them — banned word(s) detected: \`${banned.join(", ")}\``,
          ephemeral: true,
        });
      }

      // ── Ship logic ───────────────────────────────────────────────────────
      const shipName  = generateShipName(person1, person2);
      const affinity  = await getOrCreateAffinity(shipName);
      const { quality, progressBar } = getShipQualityData(affinity);

      const embed = new MessageEmbed()
        .setColor("#F8C300")
        .setTitle("💕 Ship Compatibility")
        .setDescription(`**${person1}** is \`${affinity}%\` compatible with **${person2}**!`)
        .addFields(
          { name: "🚢 Ship Name",     value: `\`${shipName}\``,                    inline: false },
          { name: "💖 Ship Strength", value: `${quality}\n${progressBar} \`${affinity}%\``, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: "Ship results are fictional and do not depict real relationships!" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("[Ship] Error:", error);
      const errPayload = { content: "⚠️ An error occurred with the ship command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errPayload);
      } else {
        await interaction.reply(errPayload);
      }
    }
  },

  async resolvePersons(interaction) {
    const { options, guild, member, user } = interaction;

    // No arguments → ship invoker with a random member
    if (options.data.length === 0) {
      const nonBots = guild.members.cache.filter((m) => !m.user.bot);
      const random  = nonBots.random();
      return {
        person1: member?.displayName ?? user.username,
        person2: random.displayName ?? random.user.username,
      };
    }

    const raw1 = options.getString("person1");
    const raw2 = options.getString("person2");

    if (raw1 && !raw2) {
      await interaction.reply({ content: "❌ Please provide a second person!", ephemeral: true });
      return null;
    }

    const person1 = await parseUserInput(raw1 ?? (member?.displayName ?? user.username), interaction);
    const person2 = await parseUserInput(raw2, interaction);

    return { person1, person2 };
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseUserInput(input, interaction) {
  const match = input?.match(/^<@!?(\d+)>$/);
  if (match) {
    try {
      const m = await interaction.guild.members.fetch(match[1]);
      return m.displayName ?? m.user.username;
    } catch {
      try {
        const u = await interaction.client.users.fetch(match[1]);
        return u.username;
      } catch {
        return input.replace(/[<>@!]/g, "");
      }
    }
  }
  return input ?? "";
}

function checkBannedContent(p1, p2) {
  const found = new Set();
  const inputs = [p1.toLowerCase(), p2.toLowerCase()];
  for (const input of inputs) {
    for (const w of BANNED_WORDS)       if (input.includes(w)) found.add(w);
    for (const c of BANNED_CHARACTERS)  if (input.includes(c)) found.add(c);
  }
  return [...found];
}

function generateShipName(p1, p2) {
  // Lowercase so the same pair always resolves to the same ship name in the DB
  const a = p1.toLowerCase();
  const b = p2.toLowerCase();
  return `${a.slice(0, Math.floor(a.length / 2))}${b.slice(Math.floor(b.length / 2))}`;
}

async function getOrCreateAffinity(shipName) {
  try {
    const existing = await shipSchema.findOne({ ShipName: shipName });
    if (existing) return existing.ShipStr;
    const affinity = Math.floor(Math.random() * 101);
    await shipSchema.create({ ShipName: shipName, ShipStr: affinity });
    return affinity;
  } catch (err) {
    console.error("[Ship] DB error:", err);
    return Math.floor(Math.random() * 101);
  }
}

function getShipQualityData(affinity) {
  const range = SHIP_QUALITY_RANGES.find((r) => affinity >= r.min && affinity <= r.max)
    ?? SHIP_QUALITY_RANGES[SHIP_QUALITY_RANGES.length - 1];

  const totalBars = 8;
  const fillBars  = Math.floor(range.bars);
  const isHalf    = range.bars % 1 !== 0;
  let bars = "";

  for (let i = 0; i < fillBars; i++) {
    bars += i === 0 ? emoji.fullS : emoji.full;
  }
  if (isHalf && fillBars < totalBars) bars += emoji.halfFull;

  const filled = fillBars + (isHalf ? 1 : 0);
  for (let i = filled; i < totalBars; i++) {
    bars += i === totalBars - 1 && affinity === 100 ? emoji.fullE : emoji.empty;
  }

  return { quality: range.quality, progressBar: bars };
}
