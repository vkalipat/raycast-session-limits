import { Action, ActionPanel, Color, Detail, Icon, Keyboard, openExtensionPreferences } from "@raycast/api";
import { formatObserved, formatReset, isStale, remainingPercent } from "./core/format";
import type { ProviderState, UsageWindow } from "./core/types";
import { useLimits } from "./use-limits";

export function quotaColor(window: UsageWindow): Color {
  const remaining = remainingPercent(window);
  return remaining <= 5 ? Color.Red : remaining <= 20 ? Color.Orange : Color.Green;
}

export function providerStatus(provider: ProviderState): string {
  if (provider.status === "error")
    return provider.snapshot ? "Refresh failed · previous reading" : "Unavailable";
  return provider.snapshot && isStale(provider.snapshot) ? "Stale reading" : "Current reading";
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!|>~-]/g, "\\$&");
}

export function ProviderActions({
  provider,
  refresh,
  detail = false,
}: {
  provider: ProviderState;
  refresh: () => Promise<void>;
  detail?: boolean;
}) {
  return (
    <ActionPanel>
      {!detail && (
        <Action.Push
          title="Show Details"
          icon={Icon.Sidebar}
          target={<ProviderDetail initialProvider={provider} />}
        />
      )}
      <Action
        title="Refresh Limits"
        icon={Icon.ArrowClockwise}
        shortcut={Keyboard.Shortcut.Common.Refresh}
        onAction={refresh}
      />
      {provider.snapshot?.dashboardUrl && (
        <Action.OpenInBrowser title="Open Provider Dashboard" url={provider.snapshot.dashboardUrl} />
      )}
      <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
    </ActionPanel>
  );
}

export function ProviderDetail({ initialProvider }: { initialProvider: ProviderState }) {
  const { providers, isLoading, refresh } = useLimits();
  const currentProvider = providers.find((item) => item.id === initialProvider.id);
  const removed = !isLoading && !currentProvider;
  const provider: ProviderState =
    currentProvider ??
    (isLoading
      ? initialProvider
      : {
          id: initialProvider.id,
          name: initialProvider.name,
          status: "error",
          error: "Provider no longer available. Return to the list to view your enabled providers.",
        });
  const snapshot = provider.snapshot;
  const markdown = [
    `# ${escapeMarkdown(provider.name)}`,
    `**${providerStatus(provider)}**`,
    provider.error ? escapeMarkdown(provider.error) : "",
    ...(snapshot?.windows.map(
      (window) =>
        `### ${escapeMarkdown(window.label)}\n\n**${remainingPercent(window)}% remaining** · ${window.usedPercent}% used\n\n${escapeMarkdown(formatReset(window.resetAt))}${window.resetAt && Number.isFinite(Date.parse(window.resetAt)) ? `\n\nReset time: ${escapeMarkdown(new Date(window.resetAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" }))}` : ""}`,
    ) ?? []),
    !snapshot && !removed
      ? "Sign in with the provider’s CLI, then refresh. For a custom provider, check the snapshot file selected in extension preferences."
      : "",
    snapshot && isStale(snapshot)
      ? "This reading may no longer reflect your current quota. A passed reset time does not confirm that usage has returned to zero."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={provider.name}
      markdown={markdown}
      metadata={
        snapshot ? (
          <Detail.Metadata>
            <Detail.Metadata.Label title="Status" text={providerStatus(provider)} />
            <Detail.Metadata.Label title="Observed" text={formatObserved(snapshot.updatedAt)} />
            <Detail.Metadata.Label
              title="Observation Time"
              text={new Date(snapshot.updatedAt).toLocaleString()}
            />
            <Detail.Metadata.Label title="Source" text={snapshot.source} />
            {snapshot.plan && <Detail.Metadata.Label title="Plan" text={snapshot.plan} />}
          </Detail.Metadata>
        ) : undefined
      }
      actions={<ProviderActions provider={provider} refresh={refresh} detail />}
    />
  );
}
