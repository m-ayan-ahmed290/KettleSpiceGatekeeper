const { Schema, model } = require(`mongoose`);

const blockedSchema = new Schema({
  BlockWord: String,
});

module.exports = model(`BlockWords`, blockedSchema);
