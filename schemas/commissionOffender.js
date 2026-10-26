const { Schema, model } = require("mongoose");

const commissionOffenderSchema = new Schema({
  UserID:    { type: String, required: true, unique: true },
  Username:  { type: String, required: true },
  GuildID:   { type: String, required: true },
  Strikes:   { type: Number, default: 1 },
  LastStrike: { type: Date, default: () => new Date() },
  TimedOutAt: { type: Date, default: null },
  Notes:     { type: String, default: "" },
});

module.exports = model("CommissionOffender", commissionOffenderSchema);
