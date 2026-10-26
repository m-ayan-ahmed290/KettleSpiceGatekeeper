# Kettle Spice Gatekeeper

Discord.js 13 bot with moderation, tier roles, birthdays, moderator credits, profiles, Tic Tac Toe, ships, redeem-code announcements and a dashboard API. All 13 original top-level commands remain; `/help` lists commands available to the caller. Version 2.1.0 has 19 top-level commands.

For Wispbyte, download the bundled ZIP and follow [WISPBYTE.md](WISPBYTE.md). It includes production dependencies and a launcher that applies the heap limit. New in 2.1.0: persistent DM reminders, reaction polls, purge, slowmode, server information, blocklist viewing and birthday readback.

## Small-server setup

Use Node.js 22 or later and a **remote MongoDB database**. The 512 MB budget is for the bot process; hosting MongoDB in that same budget is not supported. Interpret the requested storage budget as 1 GB (1024 MB).

1. Install production dependencies with `npm ci --omit=dev --no-audit --no-fund`.
2. Copy `.env.example` to `.env` and set `DISCORD_TOKEN`, `MONGODB_URI`, and `BOT_API_SECRET`. Existing `config.json` token/database settings still work as fallbacks. Keep existing guild, channel, role and integration IDs configured there.
3. Enable Server Members and Message Content privileged intents in the Discord developer portal. Presence intent is no longer needed. Grant the bot the permissions used by its features: member timeouts, role management, message management, audit-log access, webhook management and channel access; put its role above roles it manages.
4. Run `npm start`. The start command caps V8 old-space at 256 MB, leaving headroom for native buffers and Discord/database connections.

For systemd, copy the repository to `/opt/ktg-bot`, create an unprivileged `ktg-bot` service user with read access, and install `deploy/ktg-bot.service` into `/etc/systemd/system/`. Adjust its executable path for your Node installation. Then run `systemctl daemon-reload` and `systemctl enable --now ktg-bot` as the server administrator.

The supplied service enforces **35% of one CPU core**, **512 MiB total process memory**, and no swap. On Wispbyte/Pterodactyl or another container host, use the host's CPU=35%, RAM=512 MB, storage=1024 MB controls and the `npm start` command instead. These limits throttle CPU and can terminate an overloaded process; responsiveness depends on guild size and message volume. A JavaScript heap limit alone does not cap RSS or CPU.

The app stores attachment buffers only in memory and writes no media or log files. Production dependencies were approximately 51 MB in the development environment. Keep MongoDB external, avoid development dependencies and local backups, remove package-manager caches after installation if space is tight, and bound host logs. A filesystem/container quota is required to enforce 1024 MB storage; systemd's CPU/memory controls do not enforce disk quotas. For journald, configure a host-appropriate size limit (e.g. 32 MB); the service also rate-limits log output.

## Efficiency and behavior

- Discord caches: 50 messages per channel, 200 members per guild, 300 users globally, no presence cache; old messages are swept. Random `/ship` partners come from the bounded member cache; provide names if no partner is cached.
- Attachment recovery: a 24 MiB total buffer/reservation budget, 8 MiB maximum file, two simultaneous downloads, ten-second download timeout, ten-minute expiry and 500 metadata entries. Old entries are evicted under pressure. At most two deletion uploads run together; overflow recovery is dropped. Media recovery is best effort; files skipped, expired, oversized, or still downloading when deleted may be unavailable. Optional downloads pause above 384 MiB RSS or a 15% CPU sample. Deletion logs explain missing files.
- Role refresh: 100-member REST pages, sequential assignments and one shared in-progress refresh. Completion replies now wait for the actual job. Role changes skip unrelated member updates. Restricted-channel penalties precede history cleanup, with at most two history-cleanup jobs at once.
- MongoDB: three pooled connections; leaderboard/history queries fetch only needed fields. Automatic credit awards use atomic increments and a unique user index. The last 1,000 source IDs per moderator suppress event replay; this is a bounded deduplication window, not permanent event archival. Existing action history is preserved.
- Birthdays: checks every 15 minutes in each stored UTC offset, supports fractional offsets (e.g. 5.5), and persists the last announcement date to avoid restart/repeated-command duplicates. Eligibility and configured VIP/subscriber channels apply equally to immediate and scheduled announcements. As with any send-and-record workflow, a crash between the stored claim and Discord delivery can miss a greeting.
- Block words: whole-word/phrase matching in the configured moderation guild, cached for one minute and invalidated on edits. Commission keywords use word boundaries to reduce false positives.
- Commands: runtime permission checks, server-only handling, prompt acknowledgement of slow work, errors isolated at event boundaries. Tic Tac Toe acknowledges acceptance/final moves, caps simultaneous games at 20 and cleans up slots. Redeem announcements validate/deduplicate codes, URL-encode links and allow missing optional banner images.
- `/ping` and `/bot/stats` expose RSS, heap, sampled CPU and attachment memory. CPU is sampled every five seconds as a percentage of one core; it initially reports zero until the first sample. Graceful shutdown closes Discord, HTTP and MongoDB.

New commands are documented in [WISPBYTE.md](WISPBYTE.md). The reminder worker uses MongoDB for persistence, one minute ticks and batches of ten; it keeps no per-reminder timers. Command executions are limited to eight at once with a two-second per-user cooldown. Personal reminder text is excluded from moderator command logs.

Before first production startup, check the existing `creditschemas` collection for duplicate `UserID` values. The new unique index cannot build until duplicates are resolved. Do not blindly delete or merge credit records: preserve balances and histories using your database backup/reconciliation policy. Review index-creation errors in startup logs.

## Dashboard API

Protected endpoints require `x-bot-secret` matching `BOT_API_SECRET`. If the secret is absent, protected endpoints return 503. Set the same secret in the existing dashboard. `/health` is public and returns 200 only when Discord and MongoDB are ready, otherwise 503.

Member listing retains its array response, returns at most 100 members per request and supports `?after=<snowflake>` pagination; `X-Next-Cursor` gives the last fetched member ID. The header is exposed through CORS. Credit leaderboards omit action histories; the individual-user endpoint returns the latest 100 actions. These bounds require dashboards that previously expected a single large response to paginate. All existing endpoint paths remain.

## Verification

```sh
npm run check
npm test
npm run benchmark
npm run package
```

Tests run offline with mocked Discord/database operations and cover command definitions, help permissions, empty-cache shipping, slow acknowledgement, birthday date boundaries, credit-update concurrency/replays, blocklist behavior, attachment bursts, and real Express routing/middleware without opening a network listener. The benchmark loads every command and processes 250 synthetic 8 MiB attachments while checking cache and RSS budgets. Its CPU time is workload cost, not a claim of meeting the CPU quota.

Live Discord command execution, persisted MongoDB updates/indexes, server CPU throttling and long-running guild traffic must still be verified in staging with credentials and the target hosting limits. No production login, database mutation or deployment is performed by the offline checks.
