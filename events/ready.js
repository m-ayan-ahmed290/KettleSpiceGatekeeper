/**
 * ready.js — Bot initialization: DB connection, role sync, birthday system,
 * audit log listener, command registration.
 */

const { birthdayToday, birthdayKey, age: birthdayAge } = require("../utilities/birthdayDates");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const chalk = require("chalk");
const { MessageEmbed } = require("discord.js");
const {
  mongoURL,
  vipBDCh,
  plebBDCh,
  guildId,
  restrictedChId,
} = require("../config.json");
const { assignRolesToAllMembers } = require("../utilities/functions");
const Birthday = require("../schemas/birthdays");
const auditLogCheck = require("./auditLog");

// Roles that qualify a user for a VIP birthday channel
const ALLOWED_ROLES = [
  "939596568288456755", // Twitch Subscriber
  "1009015548488712242", // YouTube Member
];

const BIRTHDAY_CHANNEL_ID = "1105487618189295686"; // General log/announcement channel
const BIRTHDAY_CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes for timezone boundaries

module.exports = {
  name: "ready",
  once: true,

  async execute(client) {
    try {
      await connectToDatabase().catch(error => console.error("[Database]", error.message));
      await initializeBot(client);
      require("../utilities/reminders").startReminders(client);
      await setupBirthdaySystem(client);
      // await sendToRestrictChannel(client);
      auditLogCheck.execute(); // Start audit log polling
    } catch (error) {
      console.error("[Ready] Fatal error during initialization:", error);
    }
  },
};

// ─── Database ─────────────────────────────────────────────────────────────────

async function connectToDatabase() {
  if (!process.env.MONGODB_URI && !mongoURL) {
    console.warn("[Ready] mongoURL not set — skipping database connection.");
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI || mongoURL, { maxPoolSize: 3, minPoolSize: 0, serverSelectionTimeoutMS: 10_000, socketTimeoutMS: 20_000 });
  console.log(
    chalk.bgMagenta.white.bold(" 🗄️   ") +
      chalk.magentaBright("Connected to MongoDB!"),
  );
}

// ─── Bot initialization ───────────────────────────────────────────────────────

async function initializeBot(client) {
  // Post startup message
  try {
    const channel = await client.channels.fetch(BIRTHDAY_CHANNEL_ID);
    await channel.send(`✅ \`${client.user.username}\` is online!`);
  } catch (e) {
    console.warn("[Ready] Could not post startup message:", e.message);
  }

  console.log(
    chalk.bgGreen.black.bold(" 🤖  ") +
      chalk.greenBright(`Logged in as ${client.user.tag}`),
  );

  // Sync roles for all members
  assignRolesToAllMembers().catch(error => console.error("[RoleSync]", error));

  // Register slash commands
  await registerCommands(client);

  // Set bot presence
  client.user.setPresence({
    activities: [{ name: "with your roles 😉", type: 0 }],
    status: "dnd",
  });

  console.log(
    chalk.bgCyan.black.bold(" 🚀  ") +
      chalk.cyanBright("Initialization complete!"),
  );
}

async function registerCommands(client) {
  try {
    const commandsDir = path.join(__dirname, "../commands");
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));
    const commands = files
      .map((f) => require(path.join(commandsDir, f)))
      .filter((c) => c?.data)
      .map((c) => c.data);

    await client.application.commands.set(commands);

    console.log(
      chalk.bgBlue.white.bold(" 📦  ") +
        chalk.blueBright(`Registered ${commands.length} slash commands.`),
    );
  } catch (error) {
    console.error("[Ready] Failed to register commands:", error);
  }
}

// ─── Birthday system ──────────────────────────────────────────────────────────

async function setupBirthdaySystem(client) {
  await checkAndSendBirthdayMessages(client);
  setInterval(
    () => checkAndSendBirthdayMessages(client),
    BIRTHDAY_CHECK_INTERVAL_MS,
  ).unref();

  console.log(
    chalk.bgYellow.black.bold(" 🥳  ") +
      chalk.yellowBright("Birthday system ready!"),
  );
}

let jobRunning = false;
async function checkAndSendBirthdayMessages(client) {
  if (jobRunning) return;
  jobRunning = true;
  try {
    const cursor = Birthday.find().lean().cursor({ batchSize: 50 });
    for await (const birthday of cursor) {
      await processBirthday(client, birthday).catch(error => console.error("[Birthday]", error));
    }
  } catch (err) {
    console.error("[Birthday] Error during birthday check:", err);
  } finally { jobRunning = false; }
}

async function processBirthday(client, birthday) {
  if (!birthdayToday(birthday.Date, birthday.Timezone ?? 0)) return;
  const key = birthdayKey(birthday.Timezone ?? 0);
  if (birthday.LastWished === key) return;

  const guild = client.guilds.cache.get(birthday.GuildID ?? guildId);
  if (!guild) throw new Error(`Guild not found: ${birthday.GuildID}`);

  const user = await client.users.fetch(birthday.UserID).catch(() => null);
  if (!user) throw new Error(`User not found: ${birthday.UserID}`);

  // For non-VIP entries, verify the user has a qualifying role
  if (!birthday.HasRole) {
    const member = await guild.members.fetch(birthday.UserID).catch(() => null);
    if (!member) return;

    const hasRole = member.roles.cache.some((r) =>
      ALLOWED_ROLES.includes(r.id),
    );
    if (!hasRole) {
      console.log(
        `[Birthday] ${user.username} lacks required role — skipping.`,
      );
      return;
    }
  }

  const channelId = birthday.HasRole ? vipBDCh : plebBDCh;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error(`Birthday channel not found: ${channelId}`);

  const age = birthdayAge(birthday.Date, birthday.Timezone ?? 0);
  const embed = buildBirthdayEmbed(user, guild, age);

  const claimed = await Birthday.findOneAndUpdate(
    { _id: birthday._id, LastWished: { $ne: key } }, { $set: { LastWished: key } }, { new: true });
  if (!claimed) return;
  try {
    await channel.send({ content: `<@${birthday.UserID}>`, embeds: [embed] });
  } catch (error) {
    await Birthday.updateOne({ _id: birthday._id, LastWished: key }, { $set: { LastWished: birthday.LastWished || "" } });
    throw error;
  }
  console.log(
    `[Birthday] Sent birthday message for ${user.username} (age ${age})`,
  );
}

// ─── Embed builders ───────────────────────────────────────────────────────────

function buildBirthdayEmbed(user, guild, age) {
  return new MessageEmbed()
    .setTitle("🎉 Happy Birthday!")
    .setDescription(
      `The mod team wishes you a very warm birthday! 🎂\n` +
        `We hope everything goes well from today onwards.\n` +
        `On this day, you are **${age} years old**!`,
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setColor("DARK_GREEN")
    .setFooter({
      text: "Kettle's Tea Garden",
      iconURL: guild.iconURL({ dynamic: true }),
    })
    .setTimestamp();
}

async function sendToRestrictChannel(client) {
  try {
    const restrictCh = client.channels.cache.get(restrictedChId);

    const embed = new MessageEmbed()
      .setTitle("⚠️ Restricted Channel Active")
      .setDescription(
        "This channel is restricted. Any messages sent here will be deleted and the sender will be timed out for 24 hours.\nThis is intended for spam prevention. Please use the appropriate channels for your messages.",
      )
      .setColor("#FF6600")
      .setFooter({
        text: "Kettle's Tea Garden",
        iconURL: restrictCh.guild.iconURL({ dynamic: true }),
      })
      .setTimestamp();

    await restrictCh.send({ embeds: [embed] });
    console.log(
      chalk.bgRed.white.bold(" 🚫  ") +
        chalk.redBright("Sent message to restricted channel."),
    );
  } catch (error) {
    console.error(
      "[Ready] Failed to send message to restricted channel:",
      error,
    );
  }
}

module.exports.processBirthday = processBirthday;
