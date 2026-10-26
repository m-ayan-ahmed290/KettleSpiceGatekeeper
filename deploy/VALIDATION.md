# 3.0.1 validation — 26 October 2026

- Full npm audit: **0 vulnerabilities** across all installed dependencies; no advisories suppressed. See `security-audit.json`. CI runs the audit before publishing.
- **62 regression tests** pass, covering existing command definitions, permission checks, Discord 14 component serialization, per-server settings/credit/API identities, copy migration, birthday deduplication, game engines/turns/consent/cleanup, reminders, bounded native downloads and attachment bursts.
- All JavaScript syntax checks pass. No production Discord or MongoDB login/mutation is used in these offline tests.
- Synthetic attachment benchmark loads all command modules and processes 250 sequential 8 MiB attachments: peak observed application RSS **346.1 MiB**, attachment cache **24 MiB**. This is one observed workload, not a worst-case ceiling or sustained-CPU certification.
- Production packaging uses the lockfile, includes runtime modules/presets/dependencies, and excludes `.env`, `.git`, caches and historical Git content. Archives are CRC/checksum tested and the extracted bundle is tested separately.
- Host CPU/RAM/storage quotas are not applied to this development environment. Use Wispbyte's limits and monitor real traffic. The systemd unit is for a separate Linux host and cannot be validated here because SO_PASSCRED is unavailable.
- Live Discord permissions, actual legacy MongoDB records/indexes and post-migration balances still require verification on the target server using the backup/checklist in KETTLE_SETUP.md.

3.0.1 regression checks exercise differing duplicate balances, independent guilds, idempotent retries after new awards, non-fatal duplicate reporting and read-only administrator review. Tests use fixtures; the production database is not accessed from this workspace.
