const BlockWords = require("../schemas/blockWordsSchema");
let words = [];
let expires = 0;
let loading;
function invalidate() { expires = 0; }
async function containsBlockedWord(text) {
  if (Date.now() >= expires) {
    if (!loading) loading = BlockWords.find().select("BlockWord -_id").lean().then(rows => {
      words = rows.map(row => row.BlockWord?.trim().toLowerCase()).filter(Boolean);
      expires = Date.now() + 60_000;
    }).catch(error => {
      console.warn("[BlockWords]", error.message);
      expires = Date.now() + 10_000;
    }).finally(() => { loading = null; });
    await loading;
  }
  return words.some(word => {
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
