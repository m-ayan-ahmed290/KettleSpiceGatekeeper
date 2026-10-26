const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { downloadBuffer } = require('../utilities/download');
const original = global.fetch;
test('native attachment download returns buffers within the configured limit', async () => {
  global.fetch = async () => new Response('abc');
  assert.equal((await downloadBuffer('https://example.test', 8)).toString(), 'abc');
});
test('native attachment download rejects oversized headers and streamed bodies', async () => {
  global.fetch = async () => new Response('abc', { headers: { 'content-length': '100' } });
  await assert.rejects(downloadBuffer('https://example.test', 8), /limit/);
  global.fetch = async () => new Response('a long body without a length header');
  await assert.rejects(downloadBuffer('https://example.test', 8), /limit/);
});
test('native attachment download rejects HTTP errors and bounds stalled fetches', async () => {
  global.fetch = async () => new Response('missing', { status: 404 });
  await assert.rejects(downloadBuffer('https://example.test', 8), /404/);
  global.fetch = async (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  await assert.rejects(downloadBuffer('https://example.test', 8, 1), /aborted/);
});
after(() => { global.fetch = original; });
