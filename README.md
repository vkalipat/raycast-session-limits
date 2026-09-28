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

Requires **macOS**, [Raycast](https://www.raycast.com/), and **Node.js 22.14+**.

```sh
git clone https://github.com/vkalipat/raycast-session-limits.git
cd raycast-session-limits
npm ci
npm run dev
```

Open **Show Session Limits** in Raycast. You can stop the development process with `Ctrl+C`; the extension stays installed. See Raycast's [local extension guide](https://developers.raycast.com/basics/create-your-first-extension).

Distributed on GitHub; not yet listed in the Raycast Store.

## Use

1. Sign in to Codex with `codex login`, or to Claude Code with `claude`.
2. Open **Show Session Limits**. Press **Enter** for details or **⌘R** to refresh.
3. Disable providers you do not use in the extension's preferences.

For the optional menu bar, enable **Session Limits Menu Bar** in Raycast Settings → Extensions and run it once. Raycast schedules a refresh about every five minutes. Its percentage is the **lowest remaining quota across current, successfully fetched windows**; unavailable or stale readings are excluded.

The extension reuses existing CLI sign-ins. On macOS, Keychain access may need your approval when you first open the dashboard. Background refresh never opens authentication prompts. Custom profile directories can be selected in preferences; environment variables are honored when Raycast receives them.

## Privacy and accuracy

- Credentials stay on your Mac and are sent only to their provider's HTTPS usage endpoint. Tokens are never cached or logged, and the extension does not renew or modify them.
- Only normalized quota snapshots are cached locally. Custom snapshots are read locally; their dashboard links open only when selected.
- Readings older than 15 minutes, passed reset times, and failed refreshes are marked. A passed reset never becomes an invented zero. Missing quota windows are omitted, not treated as unused.
- Subscription quotas are different from token counts, API billing, and context-window size. API-key-only accounts are not supported by the built-in adapters.
- Provider usage endpoints are undocumented and may change. If sign-in expires, reopen/sign in to the provider's CLI, then refresh. See [compatibility notes](docs/providers.md#compatibility).

## Develop

```sh
npm run check   # TypeScript, ESLint, formatting, production build
npm run dev     # Watch and load into Raycast
```

Provider adapters return a small shared [`ProviderSnapshot`](src/core/types.ts). The UI has no provider-specific quota logic. Add an adapter in `src/providers/`, register it in [`src/core/load.ts`](src/core/load.ts), and add its preference to `package.json`. For integrations without code changes, use [custom snapshots](docs/providers.md).

`npm run lint:store` additionally checks Raycast Store metadata and requires a registered Raycast author username. GitHub distribution does not require Store submission.

## Credits

Compatibility was researched from [CodexBar](https://github.com/steipete/CodexBar), [claude-codex-usage](https://github.com/jun1485/claude-codex-usage), and the [official Codex credential implementation](https://github.com/openai/codex/blob/main/codex-rs/login/src/auth/storage.rs). The adapters are independently implemented for Raycast; no upstream code is bundled. Unaffiliated with the providers or Raycast.

[MIT](LICENSE)
