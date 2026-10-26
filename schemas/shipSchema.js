const { Schema, model } = require(`mongoose`);

const shipSchema = new Schema({
  ShipName: String,
  ShipStr: Number,
});

module.exports = model(`ShipSchema`, shipSchema);
