const { Schema, model } = require("mongoose");
const reminderSchema = new Schema({
  UserID: { type: String, required: true },
  GuildID: { type: String, required: true },
  Text: { type: String, required: true, maxlength: 500 },
  DueAt: { type: Date, required: true },
  LockedUntil: { type: Date, default: () => new Date(0) },
  Attempts: { type: Number, default: 0 },
  Status: { type: String, enum: ["pending", "failed"], default: "pending" },
  ExpireAt: { type: Date, required: true },
}, { timestamps: true });
reminderSchema.index({ Status: 1, DueAt: 1, LockedUntil: 1 });
reminderSchema.index({ UserID: 1, GuildID: 1, DueAt: 1 });
reminderSchema.index({ ExpireAt: 1 }, { expireAfterSeconds: 0 });
module.exports = model("Reminder", reminderSchema);
