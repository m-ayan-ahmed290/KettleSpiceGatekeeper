const creditSchema = require("../schemas/credits");
async function awardCredits({ userId, username, credits, reason, sourceId }) {
  if (!userId || !Number.isSafeInteger(credits) || credits <= 0) return;
  if (creditSchema.db && creditSchema.db.readyState !== 1) throw new Error("Credit database is unavailable");
  await creditSchema.init(); // Require the unique identity index before concurrent upserts.
  // Create the identity separately: blocked users and replays must never trigger an upsert.
  try {
    await creditSchema.updateOne({ UserID: userId },
      { $setOnInsert: { UserID: userId, Username: username || userId, Credits: 0 } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const query = { UserID: userId, Blocked: { $ne: true } };
  if (sourceId) query.RecentSources = { $ne: sourceId };
  const push = { Action: { Date: new Date(), ActionReason: reason, Credit: `+${credits}` } };
  if (sourceId) push.RecentSources = { $each: [sourceId], $slice: -1000 };
  const update = { $inc: { Credits: credits }, $push: push };
  if (username) update.$set = { Username: username };
  return creditSchema.updateOne(query, update);
}
module.exports = { awardCredits };
