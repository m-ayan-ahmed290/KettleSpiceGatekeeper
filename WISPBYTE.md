# Deploy Gatekeeper 3.0.2 on Wispbyte

Your Node.js 24.22.1 runtime is suitable. Wispbyte's published free tier provides 35% of one vCPU, 512 MB RAM and 1,024 MB disk; keep MongoDB external.

## If GitHub is linked

The startup log `if [[ -d .git ]] && [[ 0 == "1" ]]; then git pull; fi` means **automatic Git pulling is disabled**. Linking a repository alone does not prove that the running files match GitHub.

1. Stop the server and back up private configuration/database as described in [KETTLE_SETUP.md](KETTLE_SETUP.md).
2. Sync/redeploy the linked repository to the latest `main`, or enable the panel's Git auto-update option if available. Verify `package.json` says **3.0.2** after updating.
3. Refresh dependencies from the new lockfile: use `npm ci --omit=dev --ignore-scripts --no-audit --no-fund` if the panel supports shell/install commands. Otherwise remove the old `node_modules` folder in Files while stopped, then start; the startup command you posted installs dependencies only when that directory is absent. The release has no development dependency tree.
4. Keep `DISCORD_TOKEN` and `MONGODB_URI` in Startup variables or `.env`. Preserve the existing URI/database. Set optional dashboard settings only if used.
5. The panel may keep `index.js` as the startup file. **Both index.js and start.js now enforce the 256 MiB heap limit.** If editing the full command, use `node index.js` or `node start.js`.
6. Start and check migration/ready logs. Then test the commands listed in the Kettle guide. A fresh `npm audit` should report zero package vulnerabilities for this release's lockfile.

Do not set extra package names in `NODE_PACKAGES` unless genuinely required by your own code: they run another npm install on every startup and can change the audited dependency tree. Leave the extra install/uninstall fields empty for the supplied bot. Never use `npm audit fix --force` as an upgrade procedure for this project.

## If uploading a ZIP

Use **ktg-bot-wispbyte.zip** from the latest GitHub Release; it includes production dependencies and extracts directly into the server root. The GitHub Code → Download ZIP option is source only.

1. Stop and back up configuration/database. Move any old config credentials into private environment settings before overwriting `config.json`.
2. Remove the previous `node_modules` folder while stopped, upload the bundled ZIP and extract into the root. `index.js`, `bot.js`, `start.js`, `presets/`, `package.json` and `node_modules/` must be directly under the server root. The archive excludes `.env` and does not overwrite it.
3. Remove the uploaded ZIP after extraction to save storage. No npm install is needed for this bundle.
4. Use Node.js 24 and start with `index.js` or `start.js`. If the panel offers optional automatic dependency reinstalls, disable them when using the bundled dependencies.

Do not run `bot.js` directly: it is an internal implementation file. Do not run the retired credit archive/reset script. Keep the original database URI so the data migration can preserve existing records.

## Variables and permissions

Required: `DISCORD_TOKEN`, `MONGODB_URI`. Optional: `BOT_API_SECRET`, `BOT_API_PORT`, `DASHBOARD_URL`, `GUILD_ID`. The HTTP port also accepts the panel's `PORT` or `SERVER_PORT`. Enter values without quotes in panel fields; `.env` syntax allows quotes.

Enable Server Members and Message Content intents in the Discord Developer Portal. Channel permissions depend on enabled features: send/view/read history, embed links, attach files, manage messages, add reactions and manage webhooks. Roles must be below the bot's highest role; timeout and audit-credit features need Moderate Members and View Audit Log. Slowmode needs Manage Channels. New server administrators use `/setup` as described in [MULTI_GUILD.md](MULTI_GUILD.md).

Without a dashboard secret, protected API routes return 503. The dashboard secret grants operator access across all joined servers. Keep it private. `GUILD_ID` only chooses the dashboard default; use the guild header/query to select another server.

## Resources and activity

Application limits keep caches, downloads, database pooling, game sessions and bulk work bounded. CPU/RAM/storage quotas are enforced by Wispbyte, not by JavaScript. A 256 MiB heap cap leaves native-buffer/runtime headroom but does not cap total RSS. Monitor actual traffic; the benchmark is an offline synthetic burst, not a sustained-CPU guarantee.

Log into Wispbyte at least every **14 days** and follow current panel notices. Its homepage/plan comparison use 14 days, while some older KB text says monthly. Community guidance also reports sustained-CPU stops below the 35% quota, so avoid frequent dependency reinstalls and media processing. The included systemd unit is for a separate Linux host, not Wispbyte.

Sources checked for the original deployment work:

- [Wispbyte free-tier specifications](https://wispbyte.com/blog/free-hosting-comparison)
- [Wispbyte homepage/activity requirement](https://wispbyte.com/)
- [Startup and file management](https://wispbyte.com/kb/server-management)
- [Community guidance on sustained CPU](https://wispbyte.com/community/t/693840af-7e56-443a-b07b-400ed29f1646)

## If 3.0.0 stopped on duplicate credits

Update to **3.0.2** and restart with the same MongoDB URI. Leave `IMPORT_LEGACY_DATA` enabled; do not delete credit rows, drop indexes or reset the database to get past this error. The failed 3.0.0 import did not complete its marker, so the new importer resumes normally. Warnings are retained for `/migration-review`, while the bot can start. Existing guild records are not overwritten. See KETTLE_SETUP.md for the exact first-record policy and manual review steps.

## Startup error: reading createCollection

Update all source files to **3.0.2** and restart using `index.js`, keeping the same environment variables and database. This fixes model initialization before the MongoDB connection is ready. No database reset, dependency reinstall or environment change is needed for the 3.0.1 → 3.0.2 patch. The panel startup line `[[ 0 == "1" ]]` means Git auto-pull is disabled, so restarting alone does not download the fix; sync/redeploy the repository or upload the new release ZIP first.
