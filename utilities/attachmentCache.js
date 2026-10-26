/** Bounded attachment recovery: buffers + in-flight reservations share one budget. */
const fetch = require("node-fetch");
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_ENTRIES = 500;
const TTL_MS = 10 * 60 * 1000;
const cache = new Map();
let bytes = 0;
let reserved = 0;
let active = 0;

function evict(id) {
  const entry = cache.get(id);
  if (!entry) return;
  bytes -= entry.attachments.reduce((n, a) => n + (a.buffer?.length || 0), 0);
  cache.delete(id);
}
function sweep() {
  const now = Date.now();
  for (const [id, entry] of cache) if (now - entry.created >= TTL_MS) evict(id);
}
const timer = setInterval(sweep, 60_000);
timer.unref();

async function cacheMessageAttachments(message) {
  if (!message.attachments?.size || cache.has(message.id)) return;
  sweep();
  while (cache.size >= MAX_ENTRIES) evict(cache.keys().next().value);
  const record = { created: Date.now(), attachments: [] };
  cache.set(message.id, record);
  for (const att of message.attachments.values()) {
    const entry = { name: att.name, contentType: att.contentType || "application/octet-stream",
      size: att.size, buffer: null, originalUrl: att.url };
    record.attachments.push(entry);
    // No unbounded queue, and no downloads while memory is under pressure.
    if (!Number.isSafeInteger(att.size) || att.size < 0 || att.size > MAX_FILE_SIZE ||
        active >= 2 || process.memoryUsage().rss > 384 * 1024 * 1024 ||
        require("./resourceStats").resourceStats().cpuPercent > 15) continue;
    while (cache.size > 1 && bytes + reserved + MAX_FILE_SIZE > MAX_BYTES) {
      const oldest = cache.keys().next().value;
      if (oldest === message.id) break;
      evict(oldest);
    }
    if (bytes + reserved + MAX_FILE_SIZE > MAX_BYTES) continue;
    reserved += MAX_FILE_SIZE;
    active++;
    try {
      const res = await fetch(att.url, { size: MAX_FILE_SIZE, timeout: 10_000 });
      if (!res.ok) { res.body.destroy(); throw new Error(`HTTP ${res.status}`); }
      const buffer = await res.buffer();
      if (cache.get(message.id) === record) { entry.buffer = buffer; bytes += buffer.length; }
    } catch (err) {
      console.warn(`[AttachmentCache] ${message.id}: ${err.message}`);
    } finally { reserved -= MAX_FILE_SIZE; active--; }
  }
}
function consumeCache(id) {
  const entry = cache.get(id);
  if (!entry) return null;
  evict(id);
  return entry;
}
function cacheSize() { return cache.size; }
function cacheStats() { return { entries: cache.size, bytes, reserved, active, maxBytes: MAX_BYTES }; }
function clearCache() { for (const id of cache.keys()) evict(id); }
module.exports = { cacheMessageAttachments, consumeCache, cacheSize, cacheStats, clearCache };
