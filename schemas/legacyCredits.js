/**
 * schemas/legacyCredits.js — Archived copy of the credits schema.
 *
 * When the credit system was reworked (Carl-bot / Tickets-v2 embed
 * parsing replacing the audit-log-based system), all pre-existing
 * `creditSchema` documents were migrated here via
 * scripts/archiveLegacyCredits.js so `/leaderboard credits` could
 * start fresh while `/leaderboard legacy-credits` still shows the
 * old standings.
 */

const { Schema, model } = require("mongoose");

const actionSchema = new Schema({
  Date: { type: Date, default: () => new Date() },
  ActionReason: String,
  Credit: String,
});

const legacyCreditSchema = new Schema({
  Username: String,
  UserID: String,
  Credits: { type: Number, default: 0 },
  Blocked: Boolean,
  Reason: String,
  Action: [actionSchema],
});

// Explicit collection name so it doesn't collide with / get confused
// with the live "creditschemas" collection used by schemas/credits.js.
legacyCreditSchema.index({ Credits: -1 });

module.exports = model(
  "legacyCreditSchema",
  legacyCreditSchema,
  "legacycredits",
);
