const cooldowns = new Map();
let active = 0;
function enterCommand(userId, now = Date.now()) {
  if (active >= 8) return { error: 'The bot is busy. Try again shortly.' };
  if ((cooldowns.get(userId) || 0) > now) return { error: 'Wait two seconds before using another command.' };
  if (cooldowns.size >= 1000) {
    for (const [id, until] of cooldowns) if (until <= now) cooldowns.delete(id);
    if (cooldowns.size >= 1000) cooldowns.delete(cooldowns.keys().next().value);
  }
  cooldowns.set(userId, now + 2000);
  active++;
  let released = false;
  return { release() { if (!released) { active--; released = true; } } };
}
module.exports = { enterCommand };
