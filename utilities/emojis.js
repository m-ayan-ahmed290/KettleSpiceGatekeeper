const legacy = require('../data/emojis.json').emoji;
const preset = require('../presets/kettle.json');
const standard = { fullS: '🟩', full: '🟩', fullE: '🟩', halfFullS: '🟨', halfFull: '🟨', empty: '⬜',
  bp1: '•', bp2: '•', bp3: '•', bp4: '•', bp5: '•', cd1: '🎮', cd2: '🎮', cd3: '🎮',
  link: '🔗', success: '✅', loading: '⏳', failure: '❌', credits: '🪙', c_creds: '🕒' };
function emojiForGuild(guildId) { return preset.guilds[guildId] ? legacy : standard; }
module.exports = { emojiForGuild };
