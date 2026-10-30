const mongoose = require('mongoose');

// Models are loaded before Discord is ready and before connect() is called.
// Mongoose needs buffering here to defer collection/index creation until connect.
mongoose.set('bufferCommands', true);
mongoose.set('maxTimeMS', 10_000);

async function initializeModels() {
  if (mongoose.connection.readyState !== 1) throw new Error('Connect MongoDB before initializing models');
  for (const model of Object.values(mongoose.models)) await model.init();
  // Once startup has finished, fail disconnected operations promptly rather than
  // retaining queued commands during a database outage.
  mongoose.set('bufferCommands', false);
}

module.exports = { mongoose, initializeModels };
