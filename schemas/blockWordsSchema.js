const { Schema, model } = require("mongoose");
const schema = new Schema({ GuildID: { type: String, required: true }, BlockWord: { type: String, required: true } });
schema.index({ GuildID: 1, BlockWord: 1 }, { unique: true });
module.exports = model("GuildBlockWord", schema, "guildblockwords");
