/**
 * scripts/archiveLegacyCredits.js
 *
 * ONE-OFF migration script. Run this ONCE, before deploying the new
 * embed-based credit system, to:
 *   1. Copy every existing document from the live `credits` collection
 *      into the new `legacycredits` collection.
 *   2. Wipe the live `credits` collection so /leaderboard credits
 *      starts counting from zero under the new system.
 *
 * The old data is NOT lost — it's fully preserved and viewable via
 * /leaderboard legacy-credits.
 *
 * USAGE (from the bot's project root):
 *   node scripts/archiveLegacyCredits.js
 *
 * Safe to re-run: if the live collection is already empty, it exits
 * without doing anything.
 */

const mongoose = require("mongoose");
const { mongoURL } = require("../config.json");
const CreditModel = require("../schemas/credits");
const LegacyCreditModel = require("../schemas/legacyCredits");

async function run() {
  await mongoose.connect(mongoURL);
  console.log("[Migrate] Connected to MongoDB.");

  const currentCredits = await CreditModel.find().lean();
  console.log(
    `[Migrate] Found ${currentCredits.length} live credit record(s).`,
  );

  if (currentCredits.length === 0) {
    console.log(
      "[Migrate] Nothing to archive — live collection is already empty. Exiting.",
    );
    await mongoose.disconnect();
    return;
  }

  // Strip Mongo-managed fields so these insert as fresh documents in
  // the legacy collection instead of colliding on _id.
  const docs = currentCredits.map(({ _id, __v, ...rest }) => rest);

  await LegacyCreditModel.insertMany(docs);
  console.log(
    `[Migrate] Archived ${docs.length} record(s) to the legacy credits collection.`,
  );

  const { deletedCount } = await CreditModel.deleteMany({});
  console.log(
    `[Migrate] Cleared ${deletedCount} record(s) from the live credits collection.`,
  );
  console.log(
    "[Migrate] Done. /leaderboard credits now starts fresh; old data lives under /leaderboard legacy-credits.",
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[Migrate] Migration failed:", err);
  process.exit(1);
});
