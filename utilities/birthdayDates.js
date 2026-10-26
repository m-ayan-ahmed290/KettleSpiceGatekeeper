function localDate(offset = 0, now = new Date()) {
  return new Date(now.getTime() + offset * 3_600_000);
}
function birthdayToday(date, offset = 0, now = new Date()) {
  const local = localDate(offset, now), birth = new Date(date);
  return local.getUTCMonth() === birth.getUTCMonth() && local.getUTCDate() === birth.getUTCDate();
}
function birthdayKey(offset = 0, now = new Date()) { return localDate(offset, now).toISOString().slice(0, 10); }
function age(date, offset = 0) {
  const now = localDate(offset), birth = new Date(date);
  let years = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() ||
      (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) years--;
  return years;
}
module.exports = { birthdayToday, birthdayKey, age };
