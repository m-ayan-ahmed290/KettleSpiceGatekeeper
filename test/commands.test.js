const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { Collection } = require("discord.js");
const client = require("../utilities/client");
const expected = ["birthday", "block-words", "credits", "edit-ship", "leaderboard", "manage-mod", "ping", "profile", "redeem", "roles-management", "ship", "game", "warn", "help", "remind", "poll", "purge", "slowmode", "serverinfo", "setup", "migration-review"];
test("all existing commands plus help load and serialize valid definitions", () => {
  client.commands = new Collection();
  for (const file of fs.readdirSync(require("path").join(__dirname, "../commands"))) {
    const command = require(`../commands/${file}`);
    const data = command.data.toJSON();
    assert.equal(typeof command.execute, "function");
    assert.ok(!client.commands.has(data.name));
    client.commands.set(data.name, command);
  }
  assert.deepEqual([...client.commands.keys()].sort(), expected.sort());
});
test("help hides privileged commands from ordinary members", async () => {
  let reply;
  await client.commands.get("help").execute({ client, user: { id: "123" }, memberPermissions: { has: () => false }, reply: async payload => { reply = payload; } });
  assert.match(reply.embeds[0].toJSON().description, /\/ship/);
  assert.doesNotMatch(reply.embeds[0].toJSON().description, /\/manage-mod|\/roles-management|\/warn/);
});
test("ship without cached partners asks for explicit names", async () => {
  let reply;
  const result = await client.commands.get("ship").resolvePersons({ options: { data: [] }, guild: { members: { cache: new Collection() } }, user: { id: "123", username: "Alice" }, reply: async p => { reply = p; } });
  assert.equal(result, null);
  assert.match(reply.content, /specify two people/);
});
test.after(() => client.destroy());

test("server setup and credit administration require server administrator permission", async () => {
  for (const name of ["setup", "manage-mod", "roles-management", "migration-review"]) {
    let reply;
    await require("../events/interactionCreate").execute({ isChatInputCommand: () => true, commandName: name,
      client, guild: { id: "test" }, user: { id: "regular-member" }, options: { data: [] },
      memberPermissions: { has: () => false }, reply: async payload => { reply = payload; } });
    assert.match(reply.content, /permission/);
  }
});
