# Gatekeeper Bot 3.0.2

A Discord bot for multiple servers: moderation, automatic roles, birthdays, moderator credits, profiles, reminders, redeem codes, polls and solo/cooperative games. It retains all 13 original commands and has 21 top-level commands, including the administrator-only `/setup` command.

**Already using it in Kettle's server? Read [KETTLE_SETUP.md](KETTLE_SETUP.md) before updating.** It explains the original settings and the non-destructive data import. For another server, follow [MULTI_GUILD.md](MULTI_GUILD.md).

- [Upload or Git deployment on Wispbyte](WISPBYTE.md)
- [Game rules and commands](GAMES.md)
- [Changes](CHANGELOG.md)

## Start

Use Node.js 24 (22.12+ also satisfies this build's declared engine requirements) and a **remote MongoDB database**. Do not run MongoDB inside the 512 MB bot container.

```sh
npm ci --omit=dev --ignore-scripts --no-audit --no-fund
npm start
```

Set these private environment variables in your hosting panel, or create `.env` from `.env.example`:

| Variable | Purpose |
| --- | --- |
| `DISCORD_TOKEN` | Required: Discord bot token. |
| `MONGODB_URI` | Required: MongoDB URI; keep the same database to retain existing data. |
| `BOT_API_SECRET` | Optional: operator-wide dashboard API secret. Protected API routes are disabled without it. |
| `BOT_API_PORT` | Optional HTTP port; otherwise uses `PORT`, `SERVER_PORT`, then 4000. |
| `DASHBOARD_URL` | Optional allowed dashboard origin. |
| `GUILD_ID` | Optional default server for dashboard requests; does not restrict the Discord bot to one server. |
| `LEGACY_GUILD_ID` | Only for forks: assigns old records without a GuildID to this joined server. Kettle uses the bundled original ID automatically. |
| `IMPORT_LEGACY_DATA` | Set to `false` to disable old-data import. Omit for the Kettle upgrade. |

Enable **Server Members** and **Message Content** intents in the Discord Developer Portal. Invite the bot using the `bot` and `applications.commands` scopes. Give it the channel and moderation permissions required by the features you enable. Presence intent is unnecessary.

Both `node index.js` and `node start.js` apply a 256 MiB old-space limit. `index.js` relaunches through the small launcher if the flag is missing; `bot.js` is the internal implementation and should not be used as the panel entry file. Tokens/database URLs in the old `config.json` remain fallbacks, but deployment archives contain blank credentials. Old guild/channel fields in that file are no longer the live server configuration.

## Multiple servers

Settings, credits and block status, archived credits, birthdays, blocked words, ships, redeem banners, strike records and new game statistics are scoped by GuildID. Profiles and reminders already had guild identities and retain their collections. New servers receive no Kettle channels, role rules, game exclusions or automatic moderation. Run `/setup view` in each server to begin.

Legacy duplicates no longer prevent startup: the importer uses the first source record as a compatibility baseline, retains every original, and records administrator-readable warnings in `/migration-review`. It never sums duplicate balances or overwrites an already imported guild record. See the preservation guide before making any manual correction.

Original Kettle defaults are isolated in `presets/kettle.json`, applied only to those exact original server IDs. Saved `/setup` choices override the preset. Custom Kettle emojis remain available there; other servers use standard Unicode emojis. Destinations are resolved through the current guild, so media/logging will never post into another server's channel.

Configuration, role maintenance and credit administration require server Administrator permission; regular moderation commands retain their individual permissions. The dashboard secret is an **operator credential across all joined servers**, not a per-server administrator login. Keep it private.

## Small-host behavior

Designed for Wispbyte's stated 35% CPU, 512 MB RAM and 1,024 MB storage tier. Host quotas enforce actual CPU/RSS/disk limits; application limits do not guarantee responsiveness under every workload.

- Discord caches: 25 messages per channel, 100 members per guild, 200 users globally, no presence cache; old messages are swept. Random `/ship` partners come from the member cache, or can be provided explicitly.
- Attachment recovery: 24 MiB buffer/reservation budget, 8 MiB/file, two simultaneous downloads, ten-minute expiry and 500 metadata records. Downloads stop under memory/CPU pressure; at most two deletion recovery jobs run together. Recovery is best effort: oversized, expired, evicted or incomplete downloads may be unavailable after deletion.
- Three MongoDB pooled connections; 100-member REST role-refresh pages; sequential bulk work; one role refresh per guild. Role rules and logs stay in the same guild.
- At most eight concurrent commands, a two-second per-person command cooldown, and twenty live game sessions across all servers. Games expire after 90 seconds idle or five minutes total; challenges expire after one minute. Games use buttons/select menus and no media rendering or external game APIs.
- Reminders use one minute ticks, ten due deliveries per pass, and at most ten pending reminders per person. Birthdays use one scheduler with timezone-aware checks every 15 minutes. No timer is allocated per reminder or database record.
- Background settings/word caches hold at most 100 guilds each. Blocklists are capped at 1,000 words/phrases per server.
- Credits use atomic increments and guild/user unique indexes. The last 1,000 source IDs per moderator suppress gateway replays; timeout audit IDs also remain in the processed-log collection. Existing credit history is retained.
- The bot writes no downloaded media or application log files to disk. Remove uploaded ZIPs, old dependency trees and unused package caches on the host. Keep database backups outside the bot container.

`/ping` and `/bot/stats` expose sampled CPU, RSS, heap and attachment memory. CPU sampling is a percentage of one core, every five seconds; the first sample starts at zero. Optional media downloads pause above 384 MiB RSS or a 15% CPU sample. The platform can still throttle or stop overloaded free servers.

## Dashboard compatibility

Existing `/bot/...` paths remain. Authenticate with `x-bot-secret`; choose a joined server with `x-guild-id` or `?guildId=`. If omitted, `GUILD_ID` applies; the original Kettle server remains the compatibility fallback. `/bot/guilds` lists up to 100 joined servers with operator authentication. `/health` is public and returns 200 only after Discord, MongoDB and migration are ready.

Members use bounded REST pages with `?limit=` (max 100) and `?after=<snowflake>`; `X-Next-Cursor` contains the next cursor. Credit lists omit histories; the single-user endpoint returns the latest 100 actions. CORS exposes the cursor and accepts the guild header.

## Validation and packaging

```sh
npm run check
npm test
npm audit
npm run benchmark
npm run package
```

The audit runs against all dependencies, including transitives; this release does not suppress advisories or use force-installed overrides. CI blocks publication on any reported vulnerability. The development watcher uses Node's built-in `--watch`, removing the nodemon dependency chain.

The tests cover command serialization, permissions, Discord components, multiple-server settings and data queries, copy migration, birthday deduplication, credit concurrency/replays, game engines/turns/expiry cleanup, reminders, API routing, blocklists and attachment bursts. External Discord/MongoDB operations are mocked. The synthetic benchmark loads every command and processes 250 8 MiB attachments; run it locally or in CI, not on the free host. It measures workload cost and observed RSS, not compliance with the host's sustained CPU policy.

`npm run package` creates flat source and production-dependency ZIPs in `dist/`, plus a manifest and SHA256 checksums. It excludes `.env`, `.git`, caches and Git history, and refuses to package credentials in `config.json`. GitHub Actions tests, audits and publishes the ZIPs automatically for a new version on `main`. Live Discord permissions, MongoDB access/import, hosting quotas and sustained traffic still require validation on your server.
