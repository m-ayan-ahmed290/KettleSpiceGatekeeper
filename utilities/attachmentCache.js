/**
 * attachmentCache.js
 *
 * WHY THIS EXISTS:
 * When a message is deleted, Discord invalidates its CDN attachment URLs almost
 * immediately — sometimes before the bot's messageDelete handler even runs.
 * This means any fetch() call inside messageDelete will get a 403/404.
 *
 * The fix: on messageCreate we eagerly download every attachment buffer and
 * store it here keyed by message ID. When messageDelete fires, the buffer is
 * already in memory and ready to re-upload.
 *
 * Cache entries are automatically evicted after TTL_MS to keep memory bounded.
 */

const fetch = require("node-fetch");

const TTL_MS = 10 * 60 * 1000; // 10 minutes — well beyond any realistic delete lag
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — skip huge files (videos, etc. cached separately)

/** @type {Map<string, {attachments: CachedAttachment[], timer: NodeJS.Timeout}>} */
const cache = new Map();

/**
 * @typedef {Object} CachedAttachment
 * @property {string} name
 * @property {string} contentType
 * @property {number} size
 * @property {Buffer|null} buffer  — null if download failed or file was too large
 * @property {string} originalUrl — original CDN URL (for reference/logging)
 */

/**
 * Downloads and caches all attachments for a message.
 * Call this from messageCreate.
 * @param {import('discord.js').Message} message
 */
async function cacheMessageAttachments(message) {
  if (!message.attachments?.size) return;

  const attachments = [...message.attachments.values()];

  const cached = await Promise.all(
    attachments.map(async (att) => {
      /** @type {CachedAttachment} */
      const entry = {
        name: att.name,
        contentType: att.contentType ?? "application/octet-stream",
        size: att.size,
        buffer: null,
        originalUrl: att.url,
      };

      if (att.size > MAX_FILE_SIZE) {
        // Too large to buffer — messageDelete will note this and skip re-upload
        return entry;
      }

      try {
        const res = await fetch(att.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        entry.buffer = await res.buffer();
      } catch (err) {
        console.warn(`[AttachmentCache] Failed to pre-cache "${att.name}" (${message.id}):`, err.message);
      }

      return entry;
    })
  );

  // Evict any existing entry first (e.g. edit → delete cycle)
  evict(message.id);

  const timer = setTimeout(() => cache.delete(message.id), TTL_MS);
  cache.set(message.id, { attachments: cached, timer });
}

/**
 * Retrieves and removes cached attachments for a message.
 * Call this from messageDelete — returns null if not cached (partial/very old message).
 * @param {string} messageId
 * @returns {{ attachments: CachedAttachment[] } | null}
 */
function consumeCache(messageId) {
  const entry = cache.get(messageId);
  if (!entry) return null;
  evict(messageId);
  return entry;
}

function evict(messageId) {
  const entry = cache.get(messageId);
  if (!entry) return;
  clearTimeout(entry.timer);
  cache.delete(messageId);
}

/** Exposed for diagnostics (e.g. /ping command). */
function cacheSize() {
  return cache.size;
}

module.exports = { cacheMessageAttachments, consumeCache, cacheSize };
