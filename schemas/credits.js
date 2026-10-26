const { Schema, model } = require(`mongoose`);

const actionSchema = new Schema({
  Date: { type: Date, default: () => new Date() },
  ActionReason: String,
  Credit: String,
});

const creditSchema = new Schema({
  Username: String,
  UserID: { type: String, unique: true, sparse: true },
  RecentSources: { type: [String], default: [], select: false },
  Credits: { type: Number, default: 0 },
  Blocked: Boolean,
  Reason: String,
  Action: [actionSchema],
});

creditSchema.index({ Credits: -1 });

module.exports = model(`creditSchema`, creditSchema);
