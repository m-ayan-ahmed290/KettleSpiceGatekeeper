const { Schema, model } = require("mongoose");
const schema = new Schema({ GuildID: { type: String, required: true }, UserID: { type: String, required: true },
  Username: String, Credits: { type: Number, default: 0 }, Blocked: Boolean, Reason: String,
  Action: [{ Date: { type: Date, default: Date.now }, ActionReason: String, Credit: String }],
});
schema.index({ GuildID: 1, UserID: 1 }, { unique: true });
schema.index({ GuildID: 1, Credits: -1 });
module.exports = model("GuildLegacyCredit", schema, "guildlegacycredits");
