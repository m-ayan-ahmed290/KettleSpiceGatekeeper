const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runCommand } = require("../utilities/runCommand");
const { birthdayToday, birthdayKey, age } = require("../utilities/birthdayDates");
test("birthday offsets cross UTC days including fractional offsets", () => {
  const now = new Date("2026-12-31T19:00:00Z");
  assert.equal(birthdayToday("2000-01-01", 5.5, now), true);
  assert.equal(birthdayToday("2000-01-01", -5, now), false);
  assert.equal(birthdayKey(5.5, now), "2027-01-01");
  assert.equal(birthdayToday("2000-02-29", 0, new Date("2024-02-29")), true);
});
test("slow replies are acknowledged once, preserve this, and return a message", async () => {
  const calls = [];
  const interaction = {
    deferred: false, replied: false,
    async deferReply(options) { this.deferred = true; calls.push(["defer", options]); },
    async reply() { calls.push(["reply"]); },
    async editReply(options) { this.replied = true; calls.push(["edit", options]); return { id: "message" }; },
  };
  const original = interaction.reply;
  const command = { data: { name: "birthday" }, marker: true, async execute(i) {
    assert.equal(this.marker, true);
    await new Promise(resolve => setTimeout(resolve, 20));
    await i.deferReply({ ephemeral: true });
    return i.reply({ content: "done", ephemeral: true, fetchReply: true });
  } };
  assert.deepEqual(await runCommand(command, interaction, 1), { id: "message" });
  assert.deepEqual(calls, [["defer", { ephemeral: true }], ["edit", { content: "done" }]]);
  assert.equal(interaction.reply, original);
});
test("command failures restore methods and propagate", async () => {
  const i = { reply() {}, deferReply() {} }, original = i.reply;
  await assert.rejects(runCommand({ data: { name: "test" }, execute() { throw new Error("failed"); } }, i), /failed/);
  assert.equal(i.reply, original);
});
