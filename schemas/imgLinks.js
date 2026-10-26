const { Schema, model } = require("mongoose");
module.exports = model("GuildImageLinks", new Schema({ GuildID: { type: String, required: true, unique: true }, Genshin: String, HSR: String, ZZZ: String }), "guildimagelinks");
