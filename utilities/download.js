async function downloadBuffer(url, maxBytes, timeout = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "error" });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
    if (Number(response.headers.get("content-length")) > maxBytes) {
      await response.body?.cancel(); throw new Error("Attachment exceeds cache limit");
    }
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > maxBytes) { controller.abort(); throw new Error("Attachment exceeds cache limit"); }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, bytes);
  } finally { clearTimeout(timer); }
}
module.exports = { downloadBuffer };
