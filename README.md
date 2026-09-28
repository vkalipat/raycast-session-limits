<img src="assets/icon.png" width="72" height="72" alt="Session Limits icon" />

# Session Limits

Your coding assistant quotas, in Raycast. See what's left, when it resets, and how fresh the reading is.

**[Download for macOS](https://github.com/vkalipat/raycast-session-limits/releases/latest/download/session-limits.zip)** · [Changelog](CHANGELOG.md)

## Install

Requires **macOS and Raycast 2.5.3+**.

1. Download the ZIP above and unzip it.
2. Run **Import Extension** in Raycast. Select the **Session Limits** folder.
3. Open **Show Session Limits**.

No terminal, npm, scripts, or API keys to configure. Raycast may ask you to sign in before importing. To update, import the latest ZIP the same way.

## Connect

| Provider            | Setup                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **Codex**           | Your existing Codex sign-in is detected automatically.             |
| **Claude Code**     | Choose **Connect Claude Code**. Approve macOS access if asked.     |
| **Other providers** | Select a [local quota snapshot](docs/providers.md) in preferences. |

Sign in to the provider's official app or CLI first. If Claude's connection expires, reopen Claude Code and reconnect here. Automatic refresh never requests access to Claude's system Keychain.

## Use

- **Enter** opens quota details, including exact reset times.
- **⌘R** refreshes your limits.
- **Session Limits Menu Bar** adds an optional menu-bar view with refresh about every five minutes.

The menu-bar percentage is the lowest remaining quota across current readings. Failed refreshes and stale data are labeled and excluded from that total. Disable providers you don't use in preferences.

## Privacy

No server, telemetry, or browser scraping. Claude's access token is kept in Raycast's encrypted local storage; its refresh token is never stored. Only quota snapshots go into the display cache.

These are subscription limits, not API billing or context-window usage. [Compatibility and credential details →](docs/providers.md#compatibility)

## Develop

Node.js 22.14+ is required for development only.

```sh
git clone https://github.com/vkalipat/raycast-session-limits.git
cd raycast-session-limits
npm ci
npm run dev
```

`npm run check` runs TypeScript, lint, formatting, and the production build. `npm run bundle` creates the installable ZIP in `release/`.

One runtime dependency: the Raycast API. Adapters return a shared [`ProviderSnapshot`](src/core/types.ts); register new adapters in [`src/core/load.ts`](src/core/load.ts). The UI remains provider-neutral.

Distributed through GitHub, not the Raycast Store. Store validation is available through `npm run lint:store`.

## Credits

Compatibility research: [CodexBar](https://github.com/steipete/CodexBar), [claude-codex-usage](https://github.com/jun1485/claude-codex-usage), and [OpenAI Codex](https://github.com/openai/codex). Independently implemented; no upstream code bundled. Unaffiliated with the providers or Raycast.

[MIT license](LICENSE)
