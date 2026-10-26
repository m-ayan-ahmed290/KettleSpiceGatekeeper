const { Schema, model } = require('mongoose');
const schema = new Schema({
  GuildID: { type: String, required: true }, Source: { type: String, required: true },
  IdentityKey: { type: String, required: true }, Identity: Schema.Types.Mixed,
  Kind: { type: String, enum: ['duplicate', 'missing-identifier'], required: true },
  RecordCount: { type: Number, default: 0 }, FirstRecordId: String,
}, { timestamps: true });
schema.index({ GuildID: 1, Source: 1, IdentityKey: 1 }, { unique: true });
module.exports = model('LegacyImportReview', schema, 'legacyimportreviews');
