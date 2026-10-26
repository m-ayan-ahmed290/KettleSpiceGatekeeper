const { Schema, model } = require("mongoose");

const ProfileSchema = new Schema({
  Username: { type: String, required: true },
  UserID: { type: String, required: true }, // Remove unique: true
  GuildID: { type: String, required: true },
  Points: { type: Number, required: true, default: 0 },
  DateJoined: { type: Date, default: Date.now },
  Hidden: { type: Boolean, default: false },
  TicTacToe: {
    GamesPlayed: { type: Number, default: 0 },
    GamesWon: { type: Number, default: 0 },
    GamesLost: { type: Number, default: 0 },
    GamesDrawn: { type: Number, default: 0 },
    FastestWin: { type: Number, default: null },
  },
});

// Add this line for compound unique index:
ProfileSchema.index({ UserID: 1, GuildID: 1 }, { unique: true });

module.exports = model("Profile Data", ProfileSchema);
