# 3.0.3 validation — 30 October 2026

- Full npm audit: **0 vulnerabilities** across all installed dependencies; no advisories suppressed. See `security-audit.json`. CI runs the audit before publishing.
- **82 regression tests** pass, covering existing command definitions, permission checks, Discord 14 component serialization, per-server settings/credit/API identities, copy migration, birthday deduplication, game engines/turns/consent/cleanup, reminders, bounded native downloads and attachment bursts.
- All JavaScript syntax checks pass. No production Discord or MongoDB login/mutation is used in these offline tests.
- Synthetic attachment benchmark loads all command modules and processes 250 sequential 8 MiB attachments: peak observed application RSS **294.7 MiB**, attachment cache **24 MiB**. This is one observed workload, not a worst-case ceiling or sustained-CPU certification.
- Production packaging uses the lockfile, includes runtime modules/presets/dependencies, and excludes `.env`, `.git`, caches and historical Git content. Archives are CRC/checksum tested and the extracted bundle is tested separately.
- Host CPU/RAM/storage quotas are not applied to this development environment. Use Wispbyte's limits and monitor real traffic. The systemd unit is for a separate Linux host and cannot be validated here because SO_PASSCRED is unavailable.
- Live Discord permissions, actual legacy MongoDB records/indexes and post-migration balances still require verification on the target server using the backup/checklist in KETTLE_SETUP.md.

3.0.3 regression checks exercise differing duplicate balances, independent guilds, idempotent retries after new awards, non-fatal duplicate reporting and read-only administrator review. Tests use fixtures; the production database is not accessed from this workspace.

3.0.3 also exercises real Mongoose model initialization before/after connection, waits for unique index creation and verifies fail-fast disconnected reads. The driver boundary is a fixture; no live database credentials are used.

3.0.3 adds real Discord.js interaction/REST serialization fixtures around deferred replies and message component dispatch. Checks exercise acknowledgement races, setup view, migration review, reminder creation, profile confirmation, pagination, versus turn order, spectator/host feedback, session cancellation, expiry, failed sends/edits, simultaneous moves and match completion. MongoDB operations and HTTP transport are fixtures; there is no live production Discord/MongoDB login. A clean dependency bundle is also extracted and tested.
