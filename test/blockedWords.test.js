const { test } = require("node:test");
const assert = require("node:assert/strict");
let reads = 0;
const modelPath = require.resolve("../schemas/blockWordsSchema");
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  find() { reads++; return { select() { return { limit() { return { lean: async () => [{ BlockWord: "spam" }, { BlockWord: "buy now" }] }; } }; } }; },
} };
const { containsBlockedWord, invalidate } = require("../utilities/blockedWords");
test("blocklist matches whole words and phrases, coalesces reads, and invalidates", async () => {
  const result = await Promise.all([containsBlockedWord("spam!", "guild"), containsBlockedWord("spammer", "guild"), containsBlockedWord("please buy now", "guild")]);
  assert.deepEqual(result, [true, false, true]);
  assert.equal(reads, 1);
  invalidate("guild"); await containsBlockedWord("hello", "guild"); assert.equal(reads, 2);
});
