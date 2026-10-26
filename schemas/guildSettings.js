const { Schema, model } = require("mongoose");
module.exports = model("GuildSettings", new Schema({
  GuildID: { type: String, required: true, unique: true },
  Data: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true }));
