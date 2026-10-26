# Set up another Discord server

The same bot process and token can serve multiple servers. Invite it into each server using the bot/application-commands OAuth scopes. Each server gets independent data and configuration; `GUILD_ID` only selects a dashboard default and does not limit bot membership.

New servers have automatic filters, timeout credits, egg filtering, birthday announcements and role sync **disabled**. Games, profiles, reminders, polls, redeem posts and manual moderation commands are available subject to their permissions. No Kettle channel or role ID is copied into a new server.

## Administrator setup

Run these commands **inside the server you are configuring**. Setup, role maintenance and credit administration require Administrator permission.

1. `/setup view` shows feature flags and configured destinations.
2. `/setup channel kind:moderation channel:#mod-log` selects command/filter logs.
3. `/setup channel kind:deleted channel:#deleted-media` enables deleted-attachment recovery. Optionally choose `kind:media` for a separate same-server re-upload archive. Do not use a channel from another server.
4. `/setup toggle feature:commission enabled:true` enables the commission-spam filter. It deletes matches and applies a 24-hour timeout; configure log permissions first. `/block-words add` manages this server's independent whole-word/phrase blocklist; `/block-words list` supports pages. Adding a word activates its matching immediately; there is no additional blocklist toggle.
5. Set `kind:restricted` only for a deliberately restricted text channel. Messages there are deleted and the sender is timed out for 24 hours; recent history cleanup is bounded. Omit the channel in the same setup command to disable this destination.
6. `/setup toggle feature:egg enabled:true` enables egg-reaction removal. `kind:status` selects role/status logs; moderation logs are used as the reaction-log fallback.

## Automatic roles

- `/setup role source:@Subscriber target:@Member` adds a rule. Several source roles can qualify for the same target.
- Add `remove:true` to remove a source mapping.
- `/setup toggle feature:roles enabled:true` enables the rules.
- `/roles-management refresh` reconciles missing roles in this server with bounded REST pages. Later member role changes also remove automatic roles when qualification ends.
- Keep the bot's highest role above all target roles. Rules use role IDs for new setups; legacy Kettle rules retain their original names until replaced.

There are at most 20 target-role rules per server. Use `/setup view` to inspect the count. `/roles-management assign` remains available to administrators for one-off assignments.

## Birthdays

Set `kind:birthdayVip` and `kind:birthdayStandard`, then `/setup toggle feature:birthdays enabled:true`. Add VIP roles using `/setup birthday-role role:@VIP tier:VIP`. To restrict standard announcements to subscribers, set `/setup birthday-public enabled:false` and add standard-eligibility roles through `/setup birthday-role`. Otherwise standard birthdays are available to everyone.

Members set `/birthday date:1999-07-25 timezone:5.5`, view `/birthday`, or remove with `/birthday date:0`. Birthdays and removal are server-specific. Announcements use current member roles, each stored UTC offset and a persisted announcement date. Checks occur every 15 minutes; a bot crash during send/claim can miss a greeting. Disabling announcements does not remove saved birthdays.

## Moderator credits

1. Select the real Carl-bot account and its log channel with `/setup integration service:carl bot:@Carl-bot channel:#mod-log`.
2. For ticket closure credit, use `/setup integration service:tickets bot:@Tickets channel:#transcripts`.
3. `/setup toggle feature:credits enabled:true` enables trusted embed parsing and audit timeout credits.
4. Grant View Audit Log. Timeout checks run every five minutes and paginate recent entries with bounded work.

Values: ban 10, warn 7, kick 8, timeout 6, closed ticket 8. Carl-bot timeouts are skipped to avoid double credit; other unconfigured action types are not guessed. Plain moderator-name resolution uses a small bounded member search. `/credits`, `/leaderboard`, `/manage-mod` and blocked credit status apply only to the current server. New servers start with empty balances.

## Redeem banners and games

`/setup banner game:Genshin url:https://...` sets a per-server HTTPS banner; HSR and ZZZ are also supported. Banners are optional. Redeem posts use valid, deduplicated codes and clickable URL buttons.

See [GAMES.md](GAMES.md) for solo, versus and co-op games. `/game stats` and `/profile` never read another server's records. A player can have one live game in a given server; a global 20-session cap protects the host.

## Dashboard operator

Use the operator-only `BOT_API_SECRET` for all servers and select the server with `x-guild-id` or `?guildId=`. Never give that shared secret to ordinary server administrators; it authorizes actions across the bot's joined servers. Discord slash commands perform their own current-server permission checks. `/bot/guilds` provides authenticated server discovery.
