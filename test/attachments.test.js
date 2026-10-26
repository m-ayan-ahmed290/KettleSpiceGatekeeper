const { test } = require("node:test");
const assert = require("node:assert/strict");
let release;
let downloads = 0;
const fetchPath = require.resolve("../utilities/download");
require.cache[fetchPath] = { id: fetchPath, filename: fetchPath, loaded: true, exports: { downloadBuffer: async () => {
  downloads++;
  await new Promise(resolve => { const previous = release; release = () => { previous?.(); resolve(); }; });
  return Buffer.alloc(1024);
} } };
const cache = require("../utilities/attachmentCache");
function message(id, size = 1024) { return { id, attachments: new Map([["a", { name: "a.png", contentType: "image/png", size, url: "https://example.test/a" }]]) }; }
test("attachment burst bounds concurrent downloads, entries, and reserved bytes", async () => {
  const jobs = [];
  for (let n = 0; n < 3000; n++) jobs.push(cache.cacheMessageAttachments(message(String(n))));
  assert.equal(downloads, 2);
  assert.ok(cache.cacheSize() <= 500);
  assert.ok(cache.cacheStats().bytes + cache.cacheStats().reserved <= cache.cacheStats().maxBytes);
  release(); await Promise.all(jobs);
  assert.equal(cache.cacheStats().active, 0);
  assert.equal(cache.cacheStats().reserved, 0);
  cache.clearCache(); assert.equal(cache.cacheStats().bytes, 0);
});
test("consuming during a download cannot repopulate deleted entries", async () => {
  const job = cache.cacheMessageAttachments(message("consume"));
  assert.ok(cache.consumeCache("consume"));
  release(); await job;
  assert.equal(cache.consumeCache("consume"), null);
  assert.equal(cache.cacheStats().bytes, 0);
});
test("oversize attachments retain metadata without downloading", async () => {
  const before = downloads;
  await cache.cacheMessageAttachments(message("large", 20 * 1024 * 1024));
  assert.equal(downloads, before);
  assert.equal(cache.consumeCache("large").attachments[0].buffer, null);
});
