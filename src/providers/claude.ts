import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ProviderOptions, ProviderSnapshot, UsageWindow } from "../core/types";
import { claudeKeychain, configHome, readCredentials } from "./credentials";
import { fetchUsage } from "./http";
import { isoDate, percent, record, text } from "./parsing";
import { ConnectionRequired, UsageAccessError } from "../core/errors";

export const CLAUDE_CONNECTION_KEY = "claude-access-v1";

export function parseClaudeUsage(data: unknown): UsageWindow[] {
  const root = record(data);
  const windows: UsageWindow[] = [];
  const names: Record<string, string> = {
    five_hour: "5-hour",
    seven_day: "Weekly",
    seven_day_sonnet: "Sonnet · Weekly",
    seven_day_opus: "Opus · Weekly",
    seven_day_oauth_apps: "OAuth apps · Weekly",
  };
  for (const [id, label] of Object.entries(names)) {
    const window = record(root[id]);
    const usedPercent = percent(window.utilization);
    if (usedPercent !== undefined)
      windows.push({
        id,
        label,
        usedPercent,
        resetAt: isoDate(window.resets_at),
        windowMinutes: id === "five_hour" ? 300 : 10080,
      });
  }
  if (Array.isArray(root.limits))
    root.limits.forEach((item, index) => {
      const entry = record(item);
      const model = record(record(entry.scope).model);
      const name = text(model.display_name) || text(model.id);
      const usedPercent = percent(entry.percent);
      if (
        entry.kind !== "weekly_scoped" ||
        entry.is_active === false ||
        !name ||
        name.toLowerCase() === "all models" ||
        usedPercent === undefined
      )
        return;
      const label = `${name} · Weekly`;
      const window = {
        id: `weekly-scoped-${index}`,
        label,
        usedPercent,
        resetAt: isoDate(entry.resets_at),
        windowMinutes: 10080,
      };
      const existing = windows.findIndex((current) => current.label.toLowerCase() === label.toLowerCase());
      if (existing >= 0) windows[existing] = window;
      else windows.push(window);
    });
  return windows;
}
export async function fetchClaude(options: ProviderOptions): Promise<ProviderSnapshot> {
  if (options.claudeDisconnected && !options.keychainInteractive) throw new ConnectionRequired();
  const home = configHome(options.claudeConfigDir, process.env.CLAUDE_CONFIG_DIR, ".claude");
  let credentials = await readCredentials(join(home, ".credentials.json"));
  let source = "Claude Code OAuth file";
  const defaultHome = home === resolve(homedir(), ".claude");
  let importingConnection = false;
  if (!credentials && defaultHome) {
    source = "Claude Code connection";
    if (options.keychainInteractive) {
      credentials = await claudeKeychain();
      importingConnection = true;
    } else {
      const saved = await options.credentialStore?.get(CLAUDE_CONNECTION_KEY);
      if (saved) {
        try {
          credentials = { claudeAiOauth: record(JSON.parse(saved)) };
        } catch {
          await options.credentialStore?.remove(CLAUDE_CONNECTION_KEY);
        }
      }
    }
    if (!credentials) throw new ConnectionRequired();
  }
  const oauth = record(credentials?.claudeAiOauth);
  const token = text(oauth.accessToken);
  if (!token)
    throw new Error(
      "Sign in to Claude Code with a subscription account, then reconnect. API keys do not include subscription limits.",
    );
  if (Array.isArray(oauth.scopes) && !oauth.scopes.includes("user:profile"))
    throw new Error(
      "Your Claude sign-in does not include usage access. Sign in to Claude Code with a subscription account.",
    );
  if (
    typeof oauth.expiresAt === "number" &&
    Number.isFinite(oauth.expiresAt) &&
    oauth.expiresAt <= Date.now()
  ) {
    if (source === "Claude Code connection") {
      await options.credentialStore?.remove(CLAUDE_CONNECTION_KEY);
      throw new ConnectionRequired("Open Claude Code to renew your sign-in, then reconnect here.");
    }
    throw new Error("Open Claude Code to renew your sign-in, then refresh.");
  }
  let data: unknown;
  try {
    data = await fetchUsage(
      "https://api.anthropic.com/api/oauth/usage",
      { Authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20" },
      "Claude",
    );
  } catch (error) {
    if (source === "Claude Code connection" && error instanceof UsageAccessError) {
      await options.credentialStore?.remove(CLAUDE_CONNECTION_KEY);
      throw new ConnectionRequired(
        "Your Claude connection needs updating. Open Claude Code, then reconnect here.",
      );
    }
    throw error;
  }
  const windows = parseClaudeUsage(data);
  if (!windows.length) throw new Error("Claude returned no supported subscription limits for this account.");
  if (importingConnection) {
    // Store only the access token, never the CLI's refresh token or full credential record.
    const expiresAt =
      typeof oauth.expiresAt === "number" && Number.isFinite(oauth.expiresAt)
        ? oauth.expiresAt
        : Date.now() + 30 * 60_000;
    await options.credentialStore?.set(
      CLAUDE_CONNECTION_KEY,
      JSON.stringify({
        accessToken: token,
        expiresAt,
        ...(text(oauth.subscriptionType) ? { subscriptionType: text(oauth.subscriptionType) } : {}),
        ...(Array.isArray(oauth.scopes)
          ? { scopes: oauth.scopes.filter((scope) => typeof scope === "string") }
          : {}),
      }),
    );
  }
  return {
    id: "claude",
    name: "Claude Code",
    plan: text(oauth.subscriptionType),
    windows,
    updatedAt: new Date().toISOString(),
    source,
    dashboardUrl: "https://claude.ai/settings/usage",
  };
}
