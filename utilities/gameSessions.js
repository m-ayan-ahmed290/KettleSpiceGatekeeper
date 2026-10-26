const users = new Set();
let active = 0;
function reserveSession(guildId, players) {
  const keys = players.map(user => `${guildId}:${user.id}`);
  if (active >= 20 || keys.some(key => users.has(key))) return null;
  keys.forEach(key => users.add(key)); active++;
  let closed = false;
  return () => { if (!closed) { keys.forEach(key => users.delete(key)); active--; closed = true; } };
}
module.exports = { reserveSession };
