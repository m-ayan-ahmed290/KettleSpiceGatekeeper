const { Schema, model } = require(`mongoose`);

const actionSchema = new Schema({
  Date: { type: Date, default: () => new Date() },
  ActionReason: String,
  Credit: String,
});

const creditSchema = new Schema({
  Username: String,
  UserID: String,
  Credits: { type: Number, default: 0 },
  Blocked: Boolean,
  Reason: String,
  Action: [actionSchema],
});

module.exports = model(`creditSchema`, creditSchema);
