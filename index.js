const fs   = require("fs");
const path = require("path");
const { Collection } = require("discord.js");
const client = require("./utilities/client");
const { token } = require("./config.json");
const { startApiServer } = require("./api/server");

client.commands = new Collection();

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
  event.once
    ? client.once(event.name, (...args) => event.execute(...args))
    : client.on(event.name,   (...args) => event.execute(...args));
}

// Start Discord bot
client.login(token);

// Start dashboard REST API server once bot is ready
client.once("ready", () => {
  startApiServer(client);
});
