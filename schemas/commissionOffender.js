const { Schema, model } = require("mongoose");
const schema = new Schema({ GuildID: { type: String, required: true }, UserID: { type: String, required: true },
  Username: String, Strikes: { type: Number, default: 0 }, LastStrike: { type: Date, default: Date.now },
  TimedOutAt: Date, Notes: { type: String, default: "" },
});
schema.index({ GuildID: 1, UserID: 1 }, { unique: true });
schema.index({ GuildID: 1, Strikes: -1 });
module.exports = model("GuildCommissionOffender", schema, "guildcommissionoffenders");
