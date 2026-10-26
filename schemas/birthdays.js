const { Schema, model } = require(`mongoose`);

const BirthdaySchema = new Schema({
  Username: { type: String, required: true },
  UserID: { type: String, required: true, unique: true },
  GuildID: { type: String, required: true },
  Date: { type: Date, required: true },
  HasRole: { type: Boolean, required: true },
  Timezone: { type: Number, required: true }, // UTC offset, e.g. -5, 0, 5
});

module.exports = model("Birthday", BirthdaySchema);
