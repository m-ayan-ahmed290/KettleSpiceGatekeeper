const { Schema, model } = require(`mongoose`);

const shipSchema = new Schema({
  ShipName: String,
  ShipStr: Number,
});

shipSchema.index({ ShipName: 1 });
shipSchema.index({ ShipStr: -1 });

module.exports = model(`ShipSchema`, shipSchema);
