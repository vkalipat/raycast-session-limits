import { UsageAccessError } from "../core/errors";

export async function fetchUsage(
  url: string,
  headers: Record<string, string>,
  provider: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(12_000),
      redirect: "error",
    });
  } catch {
    throw new Error(`${provider} could not connect. Check your connection and refresh.`);
  }
  if (!response.ok) await response.body?.cancel().catch(() => undefined);
  if (response.status === 401)
    throw new UsageAccessError(`${provider} sign-in expired. Sign in again, then refresh.`, 401);
  if (response.status === 403)
    throw new UsageAccessError(`${provider} denied usage access. Sign in with a subscription account.`, 403);
  if (response.status === 429)
    throw new Error(`${provider} is limiting usage checks. Wait a few minutes before refreshing.`);
  if (!response.ok)
    throw new Error(
      `${provider} usage is temporarily unavailable (HTTP ${response.status}). Try again later.`,
    );
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 1024 * 1024) {
          await reader.cancel();
          throw new Error("Response too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error(`${provider} returned unreadable usage data. Try again later.`);
  }
}
