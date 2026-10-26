# 3.0.1

- Fix startup failure when the legacy credit collection contains duplicate moderator identities.
- Import the first legacy source record as a compatibility baseline without summing balances/histories, deleting source records or overwriting existing guild records on retries.
- Store duplicate/missing-identifier warnings and add the administrator-only, read-only `/migration-review` command for per-server inspection.
- Keep database connection failures fatal, while malformed legacy rows without identifiers are retained and reported instead of crashing startup.

# 3.0.0

- Upgrade to discord.js 14.27.0, Express 5.3.0 and Mongoose 8.24.7; remove unused Moment, old builders, node-fetch and nodemon dependency chains. Full npm audit reports zero vulnerabilities at validation time; CI audits every release.
- Make settings, role rules, moderation logs, credits/blocks/history, birthdays, words, ships, banners and strikes independent per guild. Add administrator-only `/setup`.
- Preserve Kettle defaults through exact-guild presets and copy old collections into new guild-aware collections without clearing or overwriting originals. Stop on ambiguous legacy identities. Document preservation and rollback limits in KETTLE_SETUP.md.
- Add solo Tic Tac Toe, number guessing, rock-paper-scissors, versus Connect Four and cooperative dungeon combat, plus per-server arcade statistics. Retain original profile statistics.
- Make the default `node index.js` startup apply the heap cap. Update Wispbyte Git-sync/dependency-refresh instructions and bundle all new runtime modules/presets.

# 2.1.0

- Keep all original commands; add help, persistent personal reminders, reaction polls, message cleanup, slowmode and server information.
- Add paginated blocklist viewing and birthday readback.
- Bound attachment buffers, Discord caches, MongoDB pools, bulk jobs and concurrent commands for small hosts.
- Fix birthday duplication/timezone handling, credit increment races, slow command acknowledgement, game acceptance, role refresh completion and uncached reaction handling.
- Protect dashboard endpoints when no API secret is configured, bound API request bodies/results, and support host-assigned HTTP ports.
- Package production dependencies into a flat Wispbyte upload ZIP, with offline checks and a heap-capped launcher.
- Remove credentials from current config; require private environment settings for the downloadable build. Previously tracked values remain in older Git history and should be rotated.
