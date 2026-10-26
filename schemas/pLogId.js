const { Schema, model } = require(`mongoose`);

const processedLogIds = new Schema({
  logId: { type: String, required: true, unique: true },
});

module.exports = model(`ProcessedLogId`, processedLogIds);
