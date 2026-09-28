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
  allowKeychain: boolean;
  keychainInteractive?: boolean;
}

export interface ProviderState {
  id: string;
  name: string;
  status: "ready" | "error";
  snapshot?: ProviderSnapshot;
  error?: string;
}

export interface Settings extends ProviderOptions {
  enableCodex: boolean;
  enableClaude: boolean;
  customProviderFile?: string;
}
