const BlockWords = require("../schemas/blockWordsSchema");
const cache = new Map(), loading = new Map();
function invalidate(guildId) { cache.delete(guildId); }
async function containsBlockedWord(text, guildId) {
  if (!guildId) return false;
  let record = cache.get(guildId);
  if (!record || record.until <= Date.now()) {
    if (!loading.has(guildId)) loading.set(guildId, BlockWords.find({ GuildID: guildId }).select("BlockWord -_id").limit(1000).lean().then(rows => {
      const words = rows.map(row => row.BlockWord?.trim().toLowerCase()).filter(Boolean);
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      const item = { words, until: Date.now() + 60_000 }; cache.set(guildId, item); return item;
    }).catch(error => {
      console.warn("[BlockWords]", error.message);
      const item = { words: record?.words || [], until: Date.now() + 10_000 }; cache.set(guildId, item); return item;
    }).finally(() => loading.delete(guildId)));
    record = await loading.get(guildId);
  }
  return record.words.some(word => {
    let from = 0, index;
    while ((index = text.indexOf(word, from)) !== -1) {
      const before = text[index - 1], after = text[index + word.length];
      if ((!before || !/[\p{L}\p{N}_]/u.test(before)) && (!after || !/[\p{L}\p{N}_]/u.test(after))) return true;
      from = index + 1;
    }
    return false;
  });
}
module.exports = { containsBlockedWord, invalidate };
