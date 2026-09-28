import { Cache, environment, getPreferenceValues, LaunchType, showToast, Toast } from "@raycast/api";
import { createHash } from "node:crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadProviders } from "./core/load";
import type { ProviderState, Settings } from "./core/types";

const cache = new Cache({ namespace: "session-limits-v1" });
const settings = getPreferenceValues<Settings>();
const cacheKey = createHash("sha256")
  .update(JSON.stringify([settings, process.env.CODEX_HOME, process.env.CLAUDE_CONFIG_DIR]))
  .digest("hex");
const background = environment.launchType === LaunchType.Background;

interface CachedResult {
  fetchedAt: number;
  providers: ProviderState[];
}

function readCache(): CachedResult | undefined {
  try {
    const value = JSON.parse(cache.get(cacheKey) ?? "null") as CachedResult | null;
    return value && typeof value.fetchedAt === "number" && Array.isArray(value.providers) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function useLimits() {
  const [providers, setProviders] = useState<ProviderState[]>(() => readCache()?.providers ?? []);
  const [isLoading, setLoading] = useState(true);
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);

  const fetchLimits = useCallback((force: boolean): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      const cached = readCache();
      // Share snapshots across commands and avoid polling on every menu opening.
      if (!force && cached && Date.now() - cached.fetchedAt < 60_000) {
        if (mounted.current) {
          setProviders(cached.providers);
          setLoading(false);
        }
        return;
      }
      if (mounted.current) setLoading(true);
      try {
        const next = await loadProviders(
          { ...settings, keychainInteractive: !background },
          cached?.providers,
        );
        cache.set(cacheKey, JSON.stringify({ fetchedAt: Date.now(), providers: next }));
        if (mounted.current) setProviders(next);
      } catch {
        if (!background)
          await showToast({
            style: Toast.Style.Failure,
            title: "Could not refresh limits",
            message: "Please try again.",
          });
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    inFlight.current = task;
    void task.finally(() => {
      inFlight.current = null;
    });
    return task;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = cache.subscribe((key) => {
      if (key === cacheKey && mounted.current) setProviders(readCache()?.providers ?? []);
    });
    void fetchLimits(false);
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [fetchLimits]);

  useEffect(() => {
    if (background) return;
    // Keep ages and expired-window warnings accurate while a view stays open.
    const timer = setInterval(() => setProviders((current) => [...current]), 30_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    await fetchLimits(true);
  }, [fetchLimits]);

  return { providers, isLoading, refresh };
}
