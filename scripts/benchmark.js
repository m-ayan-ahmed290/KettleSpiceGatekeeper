// Offline synthetic workload: no Discord/MongoDB credentials or traffic.
const assert = require("node:assert/strict");
const fetchPath = require.resolve("node-fetch");
require.cache[fetchPath] = { id: fetchPath, filename: fetchPath, loaded: true, exports: async () => ({ ok: true, buffer: async () => Buffer.alloc(8 * 1024 * 1024, 1) }) };
const fs = require("fs");
const { performance } = require("perf_hooks");
const client = require("../utilities/client");
for (const file of fs.readdirSync(require("path").join(__dirname, "../commands"))) require(`../commands/${file}`);
require("../api/server");
const cache = require("../utilities/attachmentCache");
(async () => {
  let peak = process.memoryUsage().rss;
  const start = performance.now(), cpu = process.cpuUsage();
  for (let n = 0; n < 250; n++) {
    await cache.cacheMessageAttachments({ id: String(n), attachments: new Map([["a", { size: 8 * 1024 * 1024, name: "test.png", contentType: "image/png", url: "https://example.test/file" }]]) });
    assert.ok(cache.cacheStats().bytes + cache.cacheStats().reserved <= 24 * 1024 * 1024);
    peak = Math.max(peak, process.memoryUsage().rss);
  }
  const elapsed = performance.now() - start, used = process.cpuUsage(cpu);
  assert.ok(peak < 512 * 1024 * 1024);
  console.log(JSON.stringify({ workload: "250 sequential 8 MiB attachments, all command modules loaded", elapsedMs: Math.round(elapsed), cpuMs: Math.round((used.user + used.system) / 1000), peakRssMB: +(peak / 1048576).toFixed(1), cache: cache.cacheStats(), note: "Synthetic burst; CPU quota requires the supplied service or host container limits." }, null, 2));
  cache.clearCache(); client.destroy();
})().catch(error => { console.error(error); process.exitCode = 1; });
