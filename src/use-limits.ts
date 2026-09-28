import {
  Cache,
  environment,
  getPreferenceValues,
  LaunchType,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { createHash, randomUUID } from "node:crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadProviders } from "./core/load";
import type { CredentialStore, ProviderState, Settings } from "./core/types";
import { CLAUDE_CONNECTION_KEY } from "./providers/claude";
import { ConnectionRequired } from "./core/errors";

const cache = new Cache({ namespace: "session-limits-v2" });
const settings = getPreferenceValues<Settings>();
const cacheKey = createHash("sha256")
  .update(JSON.stringify([settings, process.env.CODEX_HOME, process.env.CLAUDE_CONFIG_DIR]))
  .digest("hex");
const background = environment.launchType === LaunchType.Background;
const DISCONNECTED_KEY = "claude-disconnected";
const CONNECTION_EPOCH_KEY = "claude-connection-epoch";

async function connectionEpoch(): Promise<string> {
  return (await LocalStorage.getItem<string>(CONNECTION_EPOCH_KEY)) ?? "initial";
}

// Raycast LocalStorage is encrypted and private to this extension. Snapshot Cache never receives tokens.
function credentialStore(epoch: string): CredentialStore {
  const scopedKey = (key: string) => `${key}:${epoch}`;
  return {
    get: (key) => LocalStorage.getItem<string>(scopedKey(key)),
    set: async (key, value) => {
      if ((await connectionEpoch()) !== epoch) throw new ConnectionRequired();
      await LocalStorage.setItem(scopedKey(key), value);
      if ((await connectionEpoch()) !== epoch) {
        await LocalStorage.removeItem(scopedKey(key));
        throw new ConnectionRequired();
      }
    },
    remove: (key) => LocalStorage.removeItem(scopedKey(key)),
  };
}

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

  const fetchLimits = useCallback((force: boolean, connectId?: string): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      const cached = readCache();
      if (!force && cached && Date.now() - cached.fetchedAt < 60_000) {
        if (mounted.current) {
          setProviders(cached.providers);
          setLoading(false);
        }
        return;
      }
      if (mounted.current) setLoading(true);
      try {
        const epoch = await connectionEpoch();
        const next = await loadProviders(
          {
            ...settings,
            credentialStore: credentialStore(epoch),
            claudeDisconnected: (await LocalStorage.getItem<string>(DISCONNECTED_KEY)) === "true",
            keychainInteractive: connectId === "claude" && !background,
          },
          cached?.providers,
        );
        // An older view/menu refresh cannot restore data after a newer connect/disconnect action.
        if ((await connectionEpoch()) !== epoch) return;
        cache.set(cacheKey, JSON.stringify({ fetchedAt: Date.now(), providers: next }));
        if (mounted.current) setProviders(next);
        if (connectId && !background) {
          const connected = next.find((provider) => provider.id === connectId)?.status === "ready";
          await showToast({
            style: connected ? Toast.Style.Success : Toast.Style.Failure,
            title: connected ? "Claude Code connected" : "Connection not completed",
            message: connected ? undefined : next.find((provider) => provider.id === connectId)?.error,
          });
        }
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
    const timer = setInterval(() => setProviders((current) => [...current]), 30_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(() => fetchLimits(true), [fetchLimits]);
  const connect = useCallback(
    async (id: string) => {
      if (id !== "claude" || background) return;
      if (inFlight.current) await inFlight.current;
      const previousEpoch = await connectionEpoch();
      await LocalStorage.setItem(CONNECTION_EPOCH_KEY, randomUUID());
      await LocalStorage.removeItem(DISCONNECTED_KEY);
      await credentialStore(previousEpoch).remove(CLAUDE_CONNECTION_KEY);
      await fetchLimits(true, id);
    },
    [fetchLimits],
  );
  const disconnect = useCallback(
    async (id: string) => {
      if (id !== "claude") return;
      const previousEpoch = await connectionEpoch();
      await LocalStorage.setItem(CONNECTION_EPOCH_KEY, randomUUID());
      await LocalStorage.setItem(DISCONNECTED_KEY, "true");
      await credentialStore(previousEpoch).remove(CLAUDE_CONNECTION_KEY);
      const cached = readCache();
      cache.set(
        cacheKey,
        JSON.stringify({
          fetchedAt: Date.now(),
          providers:
            cached?.providers.map((provider) =>
              provider.id !== id
                ? provider
                : {
                    id,
                    name: provider.name,
                    status: "setup",
                    needsConnection: true,
                    error: "Connect your existing Claude Code account to see its limits.",
                  },
            ) ?? [],
        }),
      );
      if (inFlight.current) await inFlight.current;
      await fetchLimits(true);
    },
    [fetchLimits],
  );

  return { providers, isLoading, refresh, connect, disconnect };
}
