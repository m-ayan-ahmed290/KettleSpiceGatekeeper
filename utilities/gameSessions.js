const users = new Set();
let active = 0;
function reservationError(guildId, players) {
  if (players.some(user => users.has(`${guildId}:${user.id}`)))
    return 'You or your selected partner already have a game or pending challenge here. Finish it, wait for expiry, or use /game cancel.';
  if (active >= 20) return 'All 20 game sessions are currently busy across the bot. Try again shortly.';
  return null;
}
function reserveSession(guildId, players) {
  const keys = players.map(user => `${guildId}:${user.id}`);
  if (active >= 20 || keys.some(key => users.has(key))) return null;
  keys.forEach(key => users.add(key)); active++;
  let closed = false;
  const release = () => { if (!closed) { clearTimeout(timer); keys.forEach(key => users.delete(key)); active--; closed = true; } };
  // A failed send/setup must never leave a permanent reservation.
  const timer = setTimeout(release, 7 * 60_000);
  timer.unref();
  return release;
}
module.exports = { reserveSession, reservationError };
