# Session Limits

A small Raycast extension for checking your coding assistant quotas.

See **remaining usage**, **reset times**, and **when each reading was updated** in one native list. Optional menu-bar access keeps the lowest available quota a glance away.

| Provider           | What it reads                                                                    |
| ------------------ | -------------------------------------------------------------------------------- |
| Codex              | Session, weekly, and additional limits exposed by your ChatGPT subscription      |
| Claude Code        | Five-hour, weekly, and model-specific limits exposed by your Claude subscription |
| Any other provider | A local JSON snapshot in the [documented format](docs/providers.md)              |

One runtime dependency: the Raycast API. No server, telemetry, browser scraping, or background daemon.

## Install

Requires **macOS** and **Raycast 2.5.3 or later**.

1. [Download Session Limits](https://github.com/vkalipat/raycast-session-limits/releases/latest/download/session-limits.zip) and unzip it.
2. Open **Import Extension** in Raycast and select the **Session Limits** folder.
3. Open **Show Session Limits**.

No terminal, scripts, Node.js installation, or API keys to configure. Raycast may ask you to sign in before importing.

Distributed on GitHub; not yet listed in the Raycast Store. To update, download the latest ZIP and import its folder again.

## Use

Already signed in to Codex? Your limits appear automatically using the installed Codex CLI. For Claude Code, choose **Connect Claude Code** once and approve macOS access to your existing sign-in if asked. A Claude credential file is detected automatically.

Press **Enter** for details or **⌘R** to refresh. Disable providers you do not use in preferences. If you are not signed in to a provider yet, sign in using its official app or CLI first.

For the optional menu bar, run **Session Limits Menu Bar** once. Raycast schedules a refresh about every five minutes. Its percentage is the **lowest remaining quota across current, successfully fetched windows**; unavailable or stale readings are excluded.

Claude's background refresh never reads the system Keychain. If its connection expires, reopen Claude Code and reconnect here. Custom profile directories can be selected in preferences; environment variables are honored when Raycast receives them.

## Privacy and accuracy

- Codex reuses its official CLI sign-in (or its credential file when the CLI is absent). Claude access tokens are sent only to Anthropic's HTTPS usage endpoint.
- Connecting Claude stores its access token and expiry in Raycast's encrypted local storage. Refresh tokens are never stored, and the extension does not renew Claude tokens or modify provider credentials.
- Normalized quota snapshots are cached locally. Custom snapshots are read locally; their dashboard links open only when selected.
- Readings older than 15 minutes, passed reset times, and failed refreshes are marked. A passed reset never becomes an invented zero. Missing quota windows are omitted, not treated as unused.
- Subscription quotas are different from token counts, API billing, and context-window size. API-key-only accounts are not supported by the built-in adapters.
- Provider compatibility may change. If sign-in expires, reopen the provider's app and reconnect or refresh. See [compatibility notes](docs/providers.md#compatibility).

## Develop

Development requires Node.js 22.14+ and npm.

```sh
git clone https://github.com/vkalipat/raycast-session-limits.git
cd raycast-session-limits
npm ci
npm run check   # TypeScript, ESLint, formatting, production build
npm run dev     # Watch and load into Raycast
npm run bundle  # Build release/session-limits.zip without source maps
```

Provider adapters return a small shared [`ProviderSnapshot`](src/core/types.ts). The UI has no provider-specific quota logic. Add an adapter in `src/providers/`, register it in [`src/core/load.ts`](src/core/load.ts), and add its preference to `package.json`. For integrations without code changes, use [custom snapshots](docs/providers.md).

`npm run lint:store` additionally checks Raycast Store metadata and requires a registered Raycast author username. GitHub distribution does not require Store submission.

## Credits

Compatibility was researched from [CodexBar](https://github.com/steipete/CodexBar), [claude-codex-usage](https://github.com/jun1485/claude-codex-usage), and the [official Codex credential implementation](https://github.com/openai/codex/blob/main/codex-rs/login/src/auth/storage.rs). The adapters are independently implemented for Raycast; no upstream code is bundled. Unaffiliated with the providers or Raycast.

[MIT](LICENSE)
