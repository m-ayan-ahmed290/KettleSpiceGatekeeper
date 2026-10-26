# Upload to Wispbyte

Use the **ktg-bot-wispbyte.zip** asset from the latest GitHub Release. It includes production dependencies and extracts directly into the server root. The GitHub “Code → Download ZIP” option contains source only and needs `npm ci --omit=dev --no-audit --no-fund` before use.

## Update an existing server

1. Stop the bot. Back up your existing `.env` and `config.json` locally. Keep your MongoDB database; this update does not reset credits, profiles or birthdays.
2. **Move credentials first:** put the existing token in `DISCORD_TOKEN` and the existing MongoDB connection string in `MONGODB_URI`, either in Startup environment variables or a `.env` file. The new `config.json` contains your existing server/channel IDs with blank credentials. Preserve any IDs you have changed on the server. Do not upload your `.env` to GitHub.
3. Upload `ktg-bot-wispbyte.zip` through Files and extract it into the server root. `start.js`, `index.js` and `package.json` must be directly in the root. The archive never overwrites `.env`. Remove the uploaded ZIP after extracting to save storage.
4. In Startup choose **Node.js 22 or 24**, set the entry file to **start.js**, or use **node start.js** if the panel exposes the entire startup command. The launcher applies a 256 MiB old-space limit even without a custom command. Bundled dependencies mean no dependency installation is needed. Disable optional automatic dependency reinstalls if your panel exposes that setting; leave the extra packages field empty.
5. Set `DISCORD_TOKEN` and `MONGODB_URI`. Optionally set `BOT_API_SECRET`, `BOT_API_PORT` to the allocated HTTP port, and `DASHBOARD_URL` for the existing dashboard. The bot also accepts `PORT` or `SERVER_PORT` for its HTTP listener. Without an API secret, moderation endpoints remain disabled.
6. Enable Server Members and Message Content intents in the Discord Developer Portal. Ensure the bot's role can manage the roles below it, timeout members, manage messages/channels, view audit logs, create webhooks, attach files, embed links and add reactions in the relevant channels.
7. Start. Existing global commands and the new ones are registered automatically; Discord clients may need time to refresh their command list. Test `/ping`, `/help`, `/serverinfo`, `/birthday`, and `/remind set when:1m text:test`.

Keep the **same MongoDB URI** to retain existing data. No migration/reset script runs automatically. The existing `scripts/archiveLegacyCredits.js` is an old one-off reset/archive tool; do not run it as part of this update. Review startup logs for duplicate-credit index errors before allowing new credit awards. If the existing collection contains duplicate UserIDs, reconcile them from a backup first.

## Features

- `/remind set`, `/remind list`, `/remind cancel`: persistent personal DM reminders, up to 10 pending per person. One worker checks every minute and sends up to 10 per pass, with retries. Pending reminders survive restarts. A crash after a DM is sent but before its database record is removed can produce a duplicate. Canceling a delivery already in progress cannot retract the DM. Failed reminders remain visible for seven days after their due date.
- `/poll question:... choices:Tea | Coffee`: 2–6 choices, reaction voting, multiple selections allowed. The bot adds one seed reaction per option, which should be excluded when reading counts. No background poll collectors are retained.
- `/purge amount:... user:...`: delete up to 100 matching recent messages, skipping messages at least 14 days old.
- `/slowmode seconds:...`: 0 disables slowmode; otherwise 1–21600 seconds.
- `/serverinfo`: basic server details without a full member fetch.
- `/block-words list page:...`: inspect the existing blocklist.
- `/birthday` with no arguments: privately view your saved birthday; existing date/timezone options still set or remove it.

## Limits and activity

Wispbyte publishes 35% of one vCPU, 512 MB RAM, 1 GB storage and a temporary full-core startup boost. Its homepage and plan comparison say to log into the panel every **14 days**; some older KB text says monthly. Follow the shorter interval and your panel's current notices. Wispbyte's community support has also reported sustained-CPU stops below the 35% quota; use the panel to monitor actual sustained usage.

The bot avoids media processing, limits HTTP/Discord caches, uses three MongoDB connections and bounded bulk jobs, and skips optional attachment downloads when RSS exceeds 384 MiB or sampled CPU exceeds 15%. Commands have a two-second per-person cooldown and at most eight simultaneous command executions. These are safeguards, not a promise of zero throttling under every guild workload. MongoDB must be external to this 512 MB server.

Wispbyte enforces CPU, total RAM and disk quotas. The bundled systemd unit is for a separate Linux host and is **not needed on Wispbyte**. RSS can exceed the JavaScript heap size because buffers, native memory and the runtime also use RAM. Do not run the synthetic benchmark on the free host; run it locally or in CI.

## Checked sources (26 October 2026)

- [Wispbyte free-tier specifications](https://wispbyte.com/blog/free-hosting-comparison)
- [Wispbyte homepage and activity requirement](https://wispbyte.com/)
- [Wispbyte startup and file management](https://wispbyte.com/kb/server-management)
- [Community guidance on sustained CPU](https://wispbyte.com/community/t/693840af-7e56-443a-b07b-400ed29f1646)
