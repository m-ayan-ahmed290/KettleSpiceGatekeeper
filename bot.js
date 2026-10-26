require("dotenv").config();
const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);
const fs   = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const client = require("./utilities/client");
const { token } = require("./config.json");
const { startApiServer } = require("./api/server");

client.commands = new Collection();
client.dataReady = false;

// Load commands
const commandsPath = path.join(__dirname, "commands");
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARN] Command file "${file}" is missing a data.name export.`);
  }
}

// Load events
const eventsPath = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"))) {
  const event = require(path.join(eventsPath, file));
  if (!event?.name) { console.warn(`[WARN] Event file "${file}" missing name.`); continue; }
  const handler = (...args) => Promise.resolve().then(() => event.execute(...args))
    .catch(error => console.error(`[Event:${event.name}]`, error));
  event.once ? client.once(event.name, handler) : client.on(event.name, handler);
}

// Fail clearly without exposing configuration values.
if (!(process.env.DISCORD_TOKEN || token)) {
  console.error("[Startup] Set DISCORD_TOKEN in the Wispbyte Startup variables or .env file.");
  process.exit(1);
}
// Start Discord bot
client.on("error", error => console.error("[Discord]", error));
client.login(process.env.DISCORD_TOKEN || token).catch(error => {
  console.error("[Login]", error.message);
  process.exitCode = 1;
  client.destroy();
});

// Start dashboard REST API server once bot is ready
let server;
client.once("clientReady", () => { server = startApiServer(client); });
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  require("./utilities/reminders").stopReminders();
  client.destroy();
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, shutdown);
