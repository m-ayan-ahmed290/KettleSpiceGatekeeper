const { Schema, model } = require("mongoose");
const schema = new Schema({ GuildID: { type: String, required: true }, UserID: { type: String, required: true },
  Username: String, Date: { type: Date, required: true }, HasRole: Boolean,
  LastWished: { type: String, default: "" }, Timezone: { type: Number, default: 0 },
});
schema.index({ GuildID: 1, UserID: 1 }, { unique: true });
module.exports = model("GuildBirthday", schema, "guildbirthdays");
