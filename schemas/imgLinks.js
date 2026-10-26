const { Schema, model } = require(`mongoose`);

const imgLinks = new Schema({
  Genshin: String,
  HSR: String,
  ZZZ: String,
});

module.exports = model(`imgLink`, imgLinks);
