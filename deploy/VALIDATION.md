# Offline validation — 26 October 2026

- All existing command definitions and the new `/help` command loaded successfully.
- JavaScript syntax checks pass.
- **29 regression tests pass**, using mocked Discord/MongoDB and in-process Express requests.
- Synthetic attachment benchmark loaded all command modules and processed 250 sequential 8 MiB attachments: peak observed RSS **338.3 MiB**, cache **24 MiB**. This is one observed run, not a worst-case ceiling or production load certification.
- Source plus installed development dependencies occupied approximately **52 MB**; installed dependencies alone approximately **51 MB**.
- systemd unit validation could not run in this managed environment (`SO_PASSCRED` is unavailable). Review/install the unit on the target Linux host.
- CPU quota, total memory limit and storage quota were not applied to this environment. Use the supplied service/container settings on the target server. The synthetic benchmark intentionally runs a burst and does not establish sustained CPU utilization.
- Live Discord functionality, MongoDB index creation and production traffic remain unverified because no live credentials are configured.

The 2.1.0 Wispbyte bundle installs only production dependencies and excludes `.env`, `.git`, caches and historical Git contents. Current config credentials are blank; existing local credentials were moved to the ignored `.env`. Package size and extraction/load checks are recorded in the release manifest.
