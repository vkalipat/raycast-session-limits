# Changelog

## [1.2.0] - 2026-09-28

- Claude Code connects through its official status line; no Claude tokens or Keychain access.
- One-click local setup preserves an existing status line; Disconnect restores it.
- Claude readings update while Claude Code is active. Requires Claude Code 2.1.251+ with Pro or Max.
- Visual quota gauges with per-limit details.
- Store-ready metadata, clearer setup documentation, and contribution templates.
- Codex uses its official app-server exclusively; no direct credential-file fallback.

## [1.1.1] - 2026-09-28

- New coral icon with a simple quota-bar mark.
- Shorter README with installation and account setup first.

## [1.1.0] - 2026-09-28

- Prebuilt ZIP installation through Raycast's Import Extension command; no terminal or build tools required.
- Codex integration through the official CLI's app-server.
- Explicit Connect Claude Code action with native macOS credential access and an encrypted local connection.
- Background refresh without system Keychain prompts or automation scripts.

## [1.0.0] - 2026-09-28

- Native quota dashboard and optional menu-bar command.
- Codex and Claude Code subscription limits with existing CLI sign-ins.
- Provider-neutral JSON snapshots for other integrations.
- Reset times, observation age, explicit stale/error states, and manual refresh.
