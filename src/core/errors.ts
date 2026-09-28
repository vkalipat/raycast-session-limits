export class ConnectionRequired extends Error {
  constructor(message = "Connect your existing Claude Code account to see its limits.") {
    super(message);
    this.name = "ConnectionRequired";
  }
}

export class UsageAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UsageAccessError";
  }
}
