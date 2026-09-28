import { join } from "node:path";
import type { ProviderOptions, ProviderSnapshot, UsageWindow } from "../core/types";
import { codexToken, configHome, readCredentials } from "./credentials";
import { findCodexExecutable, readCodexRateLimits } from "./codex-rpc";
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
/** App-server buckets contain camelCase windows and may include several model limits. */
export function parseCodexRpcUsage(data: unknown): UsageWindow[] {
  const root = record(data);
  const buckets = { ...record(root.rateLimitsByLimitId) };
  const primary = record(root.rateLimits);
  const primaryId = text(primary.limitId) || "codex";
  if (Object.keys(primary).length && !(primaryId in buckets)) buckets[primaryId] = primary;
  const windows: UsageWindow[] = [];
  for (const [id, value] of Object.entries(buckets)) {
    const bucket = record(value);
    const name = text(bucket.limitName) || (id === "codex" ? undefined : id);
    const convert = (value: unknown) => {
      const window = record(value);
      return {
        used_percent: window.usedPercent,
        limit_window_seconds:
          typeof window.windowDurationMins === "number" ? window.windowDurationMins * 60 : undefined,
        reset_at: window.resetsAt,
      };
    };
    const parsed = parseCodexUsage({
      rate_limit: { primary_window: convert(bucket.primary), secondary_window: convert(bucket.secondary) },
    });
    windows.push(
      ...parsed.map((window) => ({
        ...window,
        id: `${id}-${window.id}`,
        label: name ? `${name} · ${window.label}` : window.label,
      })),
    );
  }
  return windows;
}

export async function fetchCodex(options: ProviderOptions): Promise<ProviderSnapshot> {
  const home = configHome(options.codexHome, process.env.CODEX_HOME, ".codex");
  const executable = await findCodexExecutable();
  if (executable) {
    const data = record(await readCodexRateLimits(executable, home));
    const windows = parseCodexRpcUsage(data);
    if (!windows.length) throw new Error("Codex returned no supported subscription limits for this account.");
    const buckets = Object.values(record(data.rateLimitsByLimitId));
    return {
      id: "codex",
      name: "Codex",
      plan:
        text(record(data.rateLimits).planType) ||
        buckets.map((bucket) => text(record(bucket).planType)).find(Boolean),
      windows,
      updatedAt: new Date().toISOString(),
      source: "Codex app server",
      dashboardUrl: "https://chatgpt.com/codex/settings/usage",
    };
  }
  const credentials = await readCredentials(join(home, "auth.json"));
  const source = "Codex OAuth file";
  const auth = credentials && codexToken(credentials);
  if (!auth)
    throw new Error(
      "Install Codex and sign in with your ChatGPT account, then refresh. API keys do not provide subscription limits.",
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
