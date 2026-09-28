import { join } from "node:path";
import type { ProviderOptions, ProviderSnapshot, UsageWindow } from "../core/types";
import { codexKeychain, codexToken, configHome, readCredentials } from "./credentials";
import { fetchUsage } from "./http";
import { isoDate, percent, record, text } from "./parsing";

export function parseCodexUsage(data: unknown): UsageWindow[] {
  const root = record(data);
  const windows: UsageWindow[] = [];
  function addLimits(value: unknown, prefix: string, name?: string) {
    const limits = record(value);
    for (const [key, fallback] of [
      ["primary_window", "Session"],
      ["secondary_window", "Weekly"],
    ]) {
      const window = record(limits[key]);
      const usedPercent = percent(window.used_percent);
      if (usedPercent === undefined) continue;
      const seconds = window.limit_window_seconds;
      const minutes =
        typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds / 60 : undefined;
      const label =
        minutes === 300
          ? "5-hour"
          : minutes === 10080
            ? "Weekly"
            : minutes
              ? `${Math.round((minutes / 60) * 10) / 10}-hour`
              : fallback;
      windows.push({
        id: `${prefix}-${key}`,
        label: name ? `${name} · ${label}` : label,
        usedPercent,
        resetAt: isoDate(window.reset_at, true),
        windowMinutes: minutes,
      });
    }
  }
  addLimits(root.rate_limit, "codex");
  if (Array.isArray(root.additional_rate_limits))
    root.additional_rate_limits.forEach((item, index) => {
      const extra = record(item);
      addLimits(
        extra.rate_limit,
        `codex-extra-${index}`,
        text(extra.limit_name) || text(extra.metered_feature) || "Additional limit",
      );
    });
  return windows;
}
export async function fetchCodex(options: ProviderOptions): Promise<ProviderSnapshot> {
  const home = configHome(options.codexHome, process.env.CODEX_HOME, ".codex");
  let credentials = await readCredentials(join(home, "auth.json"));
  let source = "Codex OAuth file";
  if (!credentials && options.allowKeychain) {
    credentials = await codexKeychain(home, options.keychainInteractive !== false);
    source = "Codex OAuth Keychain";
  }
  const auth = credentials && codexToken(credentials);
  if (!auth)
    throw new Error(
      "Sign in with `codex login` using a ChatGPT account. API keys do not provide subscription limits. Keychain storage requires the Keychain preference.",
    );
  const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}` };
  if (auth.account) headers["ChatGPT-Account-Id"] = auth.account;
  const data = await fetchUsage("https://chatgpt.com/backend-api/wham/usage", headers, "Codex");
  const windows = parseCodexUsage(data);
  if (!windows.length) throw new Error("Codex returned no supported subscription limits for this account.");
  return {
    id: "codex",
    name: "Codex",
    plan: text(record(data).plan_type),
    windows,
    updatedAt: new Date().toISOString(),
    source,
    dashboardUrl: "https://chatgpt.com/codex/settings/usage",
  };
}
