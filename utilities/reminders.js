const Reminder = require("../schemas/reminder");
const { parseDuration } = require("./duration");
const creating = new Set();
let running = false;
let interval;
async function createReminder({ userId, guildId, text, duration }) {
  const milliseconds = parseDuration(duration);
  if (!milliseconds) throw new Error("Use a duration from 1m to 365d, such as 30m, 2h or 7d.");
  if (typeof text !== "string" || !text.trim() || text.trim().length > 500) throw new Error("Reminder text must be 1–500 characters.");
  // One active create per user keeps count+insert within the single-bot limit.
  if (creating.has(userId)) throw new Error("A reminder is already being saved. Try again shortly.");
  creating.add(userId);
  try {
    if (await Reminder.countDocuments({ UserID: userId, Status: "pending" }) >= 10) throw new Error("You already have 10 pending reminders. Cancel one first.");
    const due = new Date(Date.now() + milliseconds);
    return await Reminder.create({ UserID: userId, GuildID: guildId, Text: text.trim(), DueAt: due,
      ExpireAt: new Date(due.getTime() + 7 * 86400_000) });
  } finally { creating.delete(userId); }
}
async function deliverDueReminders(client) {
  if (running) return;
  running = true;
  try {
    for (let n = 0; n < 10; n++) {
      const now = new Date();
      const reminder = await Reminder.findOneAndUpdate({ Status: "pending", DueAt: { $lte: now }, LockedUntil: { $lte: now } },
        { $set: { LockedUntil: new Date(now.getTime() + 5 * 60_000) }, $inc: { Attempts: 1 } },
        { new: true, sort: { DueAt: 1 } }).lean();
      if (!reminder) break;
      try {
        const user = await client.users.fetch(reminder.UserID);
        await user.send({ content: `⏰ Reminder: ${reminder.Text}\nScheduled for <t:${Math.floor(new Date(reminder.DueAt).getTime() / 1000)}:f>.`, allowedMentions: { parse: [] } });
        await Reminder.deleteOne({ _id: reminder._id });
      } catch (error) {
        const permanent = error.code === 50007 || error.code === 10013 || reminder.Attempts >= 3;
        await Reminder.updateOne({ _id: reminder._id }, { $set: { Status: permanent ? "failed" : "pending",
          LockedUntil: new Date(Date.now() + 5 * 60_000) } });
        console.warn(`[Reminders] Delivery ${permanent ? "failed" : "will retry"} for ${reminder._id}: ${error.code || "unavailable"}`);
      }
    }
  } finally { running = false; }
}
function startReminders(client) {
  if (interval) return;
  const tick = () => {
    if (require("mongoose").connection.readyState !== 1 || !client.isReady()) return;
    deliverDueReminders(client).catch(error => console.error("[Reminders]", error.message));
  };
  tick();
  interval = setInterval(tick, 60_000);
  interval.unref();
}
function stopReminders() { clearInterval(interval); interval = null; }
module.exports = { createReminder, deliverDueReminders, startReminders, stopReminders };
