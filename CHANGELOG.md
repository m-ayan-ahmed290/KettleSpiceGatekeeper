# 2.1.0

- Keep all original commands; add help, persistent personal reminders, reaction polls, message cleanup, slowmode and server information.
- Add paginated blocklist viewing and birthday readback.
- Bound attachment buffers, Discord caches, MongoDB pools, bulk jobs and concurrent commands for small hosts.
- Fix birthday duplication/timezone handling, credit increment races, slow command acknowledgement, game acceptance, role refresh completion and uncached reaction handling.
- Protect dashboard endpoints when no API secret is configured, bound API request bodies/results, and support host-assigned HTTP ports.
- Package production dependencies into a flat Wispbyte upload ZIP, with offline checks and a heap-capped launcher.
- Remove credentials from current config; require private environment settings for the downloadable build. Previously tracked values remain in older Git history and should be rotated.
