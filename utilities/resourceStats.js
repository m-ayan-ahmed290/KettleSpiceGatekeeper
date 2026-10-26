const { cacheStats } = require("./attachmentCache");
let cpu = process.cpuUsage(), at = process.hrtime.bigint(), cpuPercent = 0;
const timer = setInterval(() => {
  const next = process.cpuUsage(), now = process.hrtime.bigint();
  cpuPercent = ((next.user - cpu.user + next.system - cpu.system) / (Number(now - at) / 1000)) * 100;
  cpu = next; at = now;
}, 5000);
timer.unref();
function resourceStats() {
  const mem = process.memoryUsage();
  return { cpuPercent: Number(cpuPercent.toFixed(2)), rssMB: Number((mem.rss / 1048576).toFixed(1)),
    heapMB: Number((mem.heapUsed / 1048576).toFixed(1)), memoryLimitMB: 512, cpuLimitPercent: 35,
    attachments: cacheStats() };
}
module.exports = { resourceStats };
