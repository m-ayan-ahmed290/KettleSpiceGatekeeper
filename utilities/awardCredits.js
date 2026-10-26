/**
 * utilities/awardCredits.js — Single shared entry point for granting
 * moderator credits, used by both the Carl-bot/Tickets embed parser
 * (events/messageCreate.js) and the audit-log timeout handler
 * (events/auditLog.js). Keeping this in one place means credit math,
 * the Blocked check, and the Action history log only exist once.
 */

const creditSchema = require("../schemas/credits");

/**
 * @param {Object} params
 * @param {string} params.userId - Discord user ID to credit.
 * @param {string} [params.username] - Display name, stored for readability.
 * @param {number} params.credits - Positive integer amount to add.
 * @param {string} params.reason - Short reason string, e.g. "Ban | 1060".
 */
async function awardCredits({ userId, username, credits, reason }) {
  if (!userId || !credits || credits <= 0) return;

  let creditUser = await creditSchema.findOne({ UserID: userId });
  if (creditUser?.Blocked) {
    console.log(
      `[Credits] Skipped +${credits} for ${userId} — user is blocked.`,
    );
    return;
  }

  const action = {
    Date: Date.now(),
    ActionReason: reason,
    Credit: `+${credits}`,
  };

  if (!creditUser) {
    creditUser = new creditSchema({
      Username: username ?? userId,
      UserID: userId,
      Credits: credits,
      Action: [action],
    });
  } else {
    creditUser.Credits += credits;
    if (username) creditUser.Username = username;
    creditUser.Action.push(action);
  }

  try {
    await creditUser.save();
    console.log(
      `[Credits] +${credits} → ${username ?? userId} (${userId}) for ${reason}`,
    );
  } catch (err) {
    console.error(`[Credits] Failed to save credits for ${userId}:`, err);
  }
}

module.exports = { awardCredits };
