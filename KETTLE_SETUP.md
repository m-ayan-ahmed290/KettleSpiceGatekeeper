# Preserve Kettle's existing setup when upgrading to 3.0

Keep the **same bot application/token and MongoDB URI/database**. Version 3 keeps Kettle defaults for the exact original guild IDs, while other servers receive separate data and configuration. Existing profiles and reminders remain in place. The upgrade does not run the old credit reset/archive script.

## Before uploading

1. Stop the old bot. Back up MongoDB and download the server's `.env` and `config.json` to your own computer. Keep the backup outside the 1 GB bot container.
2. Keep `DISCORD_TOKEN` and `MONGODB_URI` in private Startup variables or `.env`. Existing `config.json` credential fields remain a compatibility fallback, but the GitHub build leaves them blank. Rotate credentials that were previously tracked in Git history.
3. Review any IDs/names that you changed only on Wispbyte. The bundled defaults reflect the original repository, not changes that exist solely on the hosted server. Saved `/setup` settings will override them after upgrading.
4. Replace the code **and dependencies** with the 3.0 release. For Git deployments, sync the repository and run `npm ci --omit=dev --ignore-scripts --no-audit --no-fund`, or remove the old `node_modules` folder while stopped so the panel reinstalls from the new lockfile. An existing node_modules directory prevents the startup command shown in the Wispbyte log from reinstalling automatically.
5. Use Node.js 24. `index.js` and `start.js` both enforce the heap cap, so the panel may keep `index.js`.

## First boot and preserved data

First boot connects MongoDB, checks ambiguous legacy identities, and copies old records into new guild-aware collections **before enabling normal database commands/credits**. It streams records in batches of 25, uses upserts with `$setOnInsert`, and records a completion marker. Original collections are never cleared or modified; already imported target identities are not overwritten on a retry. The server logs copied counts, not record contents. A first import can take longer than a normal restart.

| Original data | Version 3 destination | Guild assignment |
| --- | --- | --- |
| `creditschemas` | `guildcredits` | Existing GuildID, otherwise primary Kettle guild. |
| `legacycredits` | `guildlegacycredits` | Existing GuildID, otherwise primary Kettle guild. |
| `birthdays` | `guildbirthdays` | Original GuildID, with primary fallback only when missing. |
| `blockwords` | `guildblockwords` | Existing GuildID, otherwise primary Kettle guild. |
| `shipschemas` | `guildships` | Existing GuildID, otherwise primary Kettle guild. |
| `imglinks` | `guildimagelinks` | Existing GuildID, otherwise primary Kettle guild. |
| `commissionoffenders` | `guildcommissionoffenders` | Original GuildID, otherwise primary Kettle guild. |
| Profiles | Same existing profile collection | Existing UserID/GuildID compound key. |
| Reminders | Same existing reminder collection | Existing user and server identities. |
| Processed timeout logs | Same existing processed-log collection | Globally unique Discord audit-log IDs. |

Balances, blocked status/reasons, full action history, stored ship strengths, birthdays and announcement dates are carried over. New guilds do not read the original global collections. Global historical data is assigned to the primary Kettle guild because the older bot did not store a server identity there.

If duplicate user/ship identities or malformed identifiers exist, import stops with an actionable error instead of guessing a balance or overwriting history. Back up and reconcile those source records, then restart; already imported rows are retained. Identical blocked-word duplicates are coalesced; the original records remain in the old collection. The old single-document banner semantics are retained by importing the first banner row for an identity.

Do not run `scripts/archiveLegacyCredits.js` for this update. It is retired and exits without modifying data. Do not drop old unique indexes to enable multi-guild use: the new collections have their own guild-aware indexes. Original snapshots remain useful for rollback, but after operating on 3.0 the old collections will not contain newly earned credits/birthdays; a downgrade must reconcile post-upgrade writes from a current backup.

Automatic legacy import is enabled when the bot has joined an original Kettle guild. A fork using a different guild ID can set `LEGACY_GUILD_ID` to its own joined guild for the unscoped old records. New installations using a different server need no legacy import. Set `IMPORT_LEGACY_DATA=false` only when you intentionally do not want that old data copied.

## Original server defaults

The compatibility presets are in `presets/kettle.json`. They are only selected for these original IDs. `/setup view` shows current effective choices; `/setup preset` restores the preset for that original server. Existing saved overrides remain active until explicitly changed. Channel destinations are validated against the current guild.

| Setting | Primary Kettle `929058650532757514` | Companion `1105487617690177658` |
| --- | --- | --- |
| Moderation/command log | `987057720119136356` | `1105487618189295686` |
| Deleted media log | `1003328162408710165` | `1105487618189295687` |
| Media archive candidate | `1184557200480403487` | `1184557200480403487` |
| VIP birthdays | `981568443469955172` | `1105487617740509258` |
| Standard birthdays | `1005507469864345772` | `1105487618365472861` |
| Restricted channel | `1497519020927352872` | Disabled |
| Status/role log | Not set | `1105487618189295686` |
| Commission spam filter | Enabled | Disabled |
| Moderator auto-credits | Enabled | Disabled |
| Egg-reaction filtering | Enabled | Enabled |
| Birthday announcements | Enabled | Enabled |
| Automatic tier roles | Disabled | Enabled |

**Media isolation change:** the old implementation could upload deleted media into one globally hard-coded archive. Version 3 uses that ID only if it belongs to the server whose message was deleted. Otherwise uploads fall back to that server's deletion log. Use `/setup channel kind:media channel:#archive` in each server to select an appropriate local archive.

## Birthday behavior

VIP role names are `Moderator` and `Basement Dwellers`. Standard announcements are limited to roles `939596568288456755` (Twitch Subscriber) and `1009015548488712242` (YouTube Member). Public birthdays remain disabled in the Kettle preset. The bot now checks current member roles consistently rather than trusting a stale stored VIP flag.

To repair changed channels, use `/setup channel kind:birthdayVip` and `kind:birthdayStandard`. To use explicit role IDs, select roles with `/setup birthday-role`. To allow all members instead, deliberately enable `/setup birthday-public enabled:true`. Each server's birthdays, changes and removals are independent.

## Automatic subscription roles

The companion guild retains these name-based rules:

| Any qualifying source | Automatic target |
| --- | --- |
| `Twitch Tier 1`, `YT Member Tier 1` | `Smol Teabag Tier 1` |
| `Twitch Tier 2`, `YT Member Tier 2` | `Mega Teabag Tier 2` |
| `Twitch Tier 3` | `Venti Teabag Tier 3` |

Keep these names or configure explicit current roles through `/setup role`. Enable the `roles` feature and run `/roles-management refresh` in the companion guild. The bot's role must be above all target roles. Refresh acts only on the invoking guild and waits for the real job to finish.

## Moderator credits and permissions

The primary preset trusts Carl-bot `235148962103951360` in the moderation log and Tickets bot `1325579039888511056` in transcript channel `1125114870271062086`. Preserve those bots' embed formats and give this bot View Audit Log. Values remain: ban +10, warn +7, kick +8, timeout +6, closed ticket +8. Timeout embeds are skipped to prevent double credit with the audit-log worker. Mute/unconfigured action values are not invented.

Credit balances, blocks, adjustments, leaderboards and histories are now independent per server. Old shared balances are assigned to primary Kettle; the companion starts its own credit ledger if its credit feature is later enabled.

**Permission change:** `/setup`, `/manage-mod` and `/roles-management` require server Administrator permission. The old single hard-coded owner account restriction is removed, so administrators of each server can manage only that server. Other moderation commands retain their individual permission requirements. The original Kettle game exclusions remain in its presets; unrelated servers do not inherit those user exclusions.

Kettle's custom emojis remain in use for its original guild IDs. Other servers use ordinary Unicode symbols. Displayed server names and new webhook names are generic/current-server aware.

## Check after startup

- Confirm `[Migration]` completion and `[Ready]` command registration in logs, with no duplicate-identity errors.
- `/setup view` in each original guild: check destinations and feature flags.
- `/credits`, `/leaderboard credits`, `/leaderboard legacy-credits`, `/leaderboard ships` and `/profile view`: confirm pre-upgrade values against your backup.
- `/birthday`: verify your saved date; inspect the configured birthday channels and eligibility roles.
- `/roles-management refresh` in the companion guild; inspect the intended target roles.
- `/remind set when:1m text:test`, `/game tictactoe` and `/game dungeon partner:@Friend`: verify new features.
- Monitor Wispbyte's CPU/RAM graphs. Offline tests do not establish live Discord permissions or production resource use.
