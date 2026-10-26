const units = { s: 1000, m: 60_000, h: 3600_000, d: 86400_000, w: 604800_000 };
function parseDuration(input) {
  if (typeof input !== "string") return null;
  const match = input.trim().match(/^(\d{1,7})\s*([smhdw])$/i);
  if (!match) return null;
  const milliseconds = Number(match[1]) * units[match[2].toLowerCase()];
  return milliseconds >= 60_000 && milliseconds <= 365 * 86400_000 ? milliseconds : null;
}
module.exports = { parseDuration };
