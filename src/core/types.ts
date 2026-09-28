export interface UsageWindow {
  id: string;
  label: string;
  usedPercent: number;
  resetAt?: string;
  windowMinutes?: number;
}

export interface ProviderSnapshot {
  id: string;
  name: string;
  plan?: string;
  windows: UsageWindow[];
  updatedAt: string;
  source: string;
  dashboardUrl?: string;
}

export interface ProviderOptions {
  codexHome?: string;
  claudeConfigDir?: string;
  credentialStore?: CredentialStore;
  claudeDisconnected?: boolean;
  keychainInteractive?: boolean;
}

export interface CredentialStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ProviderState {
  id: string;
  name: string;
  status: "ready" | "error" | "setup";
  needsConnection?: boolean;
  snapshot?: ProviderSnapshot;
  error?: string;
}

export interface Settings extends ProviderOptions {
  enableCodex: boolean;
  enableClaude: boolean;
  customProviderFile?: string;
}
