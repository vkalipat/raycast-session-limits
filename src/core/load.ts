import { fetchClaude } from "../providers/claude";
import { fetchCodex } from "../providers/codex";
import { fetchCustomProviders } from "../providers/custom";
import type { ProviderSnapshot, ProviderState, Settings } from "./types";

export async function loadProviders(
  settings: Settings,
  previous: ProviderState[] = [],
): Promise<ProviderState[]> {
  const tasks: Promise<ProviderState[]>[] = [];
  const collect = async (
    id: string,
    name: string,
    fetcher: () => Promise<ProviderSnapshot>,
  ): Promise<ProviderState[]> => {
    try {
      return [{ id, name, status: "ready", snapshot: await fetcher() }];
    } catch (error) {
      return [
        {
          id,
          name,
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load limits. Try refreshing.",
          snapshot: previous.find((item) => item.id === id)?.snapshot,
        },
      ];
    }
  };
  if (settings.enableCodex) tasks.push(collect("codex", "Codex", () => fetchCodex(settings)));
  if (settings.enableClaude) tasks.push(collect("claude", "Claude Code", () => fetchClaude(settings)));
  if (settings.customProviderFile?.trim()) {
    tasks.push(
      fetchCustomProviders(settings.customProviderFile).catch((error: unknown) => [
        {
          id: "custom",
          name: "Custom Providers",
          status: "error",
          error: error instanceof Error ? error.message : "Unable to read custom providers.",
        },
      ]),
    );
  }
  return (await Promise.all(tasks)).flat();
}
