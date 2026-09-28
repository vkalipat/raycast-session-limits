# Providers

## Custom snapshots

Any provider can appear alongside the built-in adapters. Write its measured quotas to a local JSON file and select that file under **Custom Providers** in the extension's preferences. The extension reads the file on refresh; your integration is responsible for collecting and updating its contents.

```json
{
  "version": 1,
  "providers": [
    {
      "id": "my-provider",
      "name": "My Provider",
      "plan": "Pro",
      "updatedAt": "2026-09-28T16:00:00Z",
      "dashboardUrl": "https://example.com/usage",
      "windows": [
        {
          "label": "Session",
          "usedPercent": 32,
          "resetAt": "2026-09-28T20:00:00Z"
        }
      ]
    }
  ]
}
```

This is illustrative data, not a live integration. Replace timestamps and percentages with measured values. A static file will become stale.

- `name`, `updatedAt`, and `windows` are required. `id`, `plan`, and `dashboardUrl` are optional.
- `id` must stay stable and unique across updates. Without an `id`, the provider name is its identity.
- Each window needs a `label` and numeric `usedPercent` from 0 to 100. `resetAt` is optional. Omit unavailable windows instead of writing zero.
- Timestamps use ISO 8601 with a timezone. `updatedAt` is the time of the actual provider observation, not the time the file was copied.
- Dashboard URLs must use HTTPS and have no embedded credentials. They are not fetched during refresh.
- A file can contain up to 30 providers, each with 1–20 windows, and must be at most 1 MiB. One invalid provider does not hide the others.
- Write a temporary file and rename it into place to avoid partially written JSON. Do not put credentials in a snapshot.

## Compatibility

| Adapter     | Credential lookup                                                                                                                                            | Usage endpoint                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Codex       | `auth.json` in the selected directory, `$CODEX_HOME`, or `~/.codex`; then the matching `Codex Auth` Keychain item                                            | `https://chatgpt.com/backend-api/wham/usage` |
| Claude Code | `.credentials.json` in the selected directory, `$CLAUDE_CONFIG_DIR`, or `~/.claude`; then `Claude Code-credentials` in Keychain for the default profile only | `https://api.anthropic.com/api/oauth/usage`  |

Codex sends the stored account ID when available. Claude sends the OAuth beta header and needs a normal subscription login with the `user:profile` scope. `claude setup-token` is not a replacement for this login.

Credential files take precedence. Explicit custom Claude profiles do not fall back to the default account's Keychain item. Codex's Keychain account is derived from its profile directory. Newer or third-party credential stores outside these formats are not supported.

Keychain reads use macOS Security APIs through the system JavaScript bridge. Background reads explicitly disallow interaction; open the dashboard to resolve access requests. The extension never changes Keychain items or grants itself access.

HTTP requests time out after 12 seconds, reject redirects, and cap JSON responses at 1 MiB. Command openings share a 60-second snapshot cache; **⌘R** explicitly requests a new reading. The dashboard updates age/reset labels while open but does not poll the network continuously. Raycast controls menu-bar scheduling and may delay background refresh.

The adapters expose only quota windows reported by the provider. Credits, spend, local transcript token estimates, and inferred allowances are outside this extension's scope. If a provider rejects access, its last reading is labeled as such and excluded from the menu-bar total.

Protocol references: [CodexBar Codex](https://github.com/steipete/CodexBar/blob/main/docs/codex.md), [CodexBar Claude](https://github.com/steipete/CodexBar/blob/main/docs/claude.md), [Codex storage](https://github.com/openai/codex/blob/main/codex-rs/login/src/auth/storage.rs), and [Apple noninteractive Keychain queries](https://developer.apple.com/documentation/security/ksecuseauthenticationuifail).
