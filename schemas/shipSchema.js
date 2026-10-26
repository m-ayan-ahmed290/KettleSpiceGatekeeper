const { Schema, model } = require("mongoose");
const schema = new Schema({ GuildID: { type: String, required: true }, ShipName: String, ShipStr: Number });
schema.index({ GuildID: 1, ShipName: 1 }, { unique: true });
schema.index({ GuildID: 1, ShipStr: -1 });
module.exports = model("GuildShip", schema, "guildships");
