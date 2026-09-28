import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { ProviderOptions, ProviderSnapshot, UsageWindow } from "../core/types";
import { claudeKeychain, configHome, readCredentials } from "./credentials";
import { fetchUsage } from "./http";
import { isoDate, percent, record, text } from "./parsing";

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
  const home = configHome(options.claudeConfigDir, process.env.CLAUDE_CONFIG_DIR, ".claude");
  let credentials = await readCredentials(join(home, ".credentials.json"));
  let source = "Claude Code OAuth file";
  const defaultHome = home === resolve(homedir(), ".claude");
  if (!credentials && defaultHome && options.allowKeychain) {
    credentials = await claudeKeychain(options.keychainInteractive !== false);
    source = "Claude Code OAuth Keychain";
  }
  const oauth = record(credentials?.claudeAiOauth);
  const token = text(oauth.accessToken);
  if (!token)
    throw new Error(
      "Sign in with `claude` using a Claude subscription. Enable Keychain access if Claude stores your login there. API keys and setup-token do not provide usage access.",
    );
  if (Array.isArray(oauth.scopes) && !oauth.scopes.includes("user:profile"))
    throw new Error(
      "Claude's token lacks usage access. Sign in again through `claude`; setup-token is for inference only.",
    );
  if (
    typeof oauth.expiresAt === "number" &&
    Number.isFinite(oauth.expiresAt) &&
    oauth.expiresAt <= Date.now()
  )
    throw new Error("Claude sign-in expired. Open Claude Code to renew it, then refresh.");
  const data = await fetchUsage(
    "https://api.anthropic.com/api/oauth/usage",
    { Authorization: `Bearer ${token}`, "anthropic-beta": "oauth-2025-04-20" },
    "Claude",
  );
  const windows = parseClaudeUsage(data);
  if (!windows.length) throw new Error("Claude returned no supported subscription limits for this account.");
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
