const { Schema, model } = require('mongoose');
const schema = new Schema({ GuildID: { type: String, required: true }, UserID: { type: String, required: true }, Game: { type: String, required: true },
  Username: String, Played: { type: Number, default: 0 }, Won: { type: Number, default: 0 }, Lost: { type: Number, default: 0 }, Drawn: { type: Number, default: 0 }, Points: { type: Number, default: 0 },
});
schema.index({ GuildID: 1, UserID: 1, Game: 1 }, { unique: true });
module.exports = model('GuildGameStats', schema, 'guildgamestats');
