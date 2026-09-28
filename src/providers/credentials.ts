import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ConnectionRequired } from "../core/errors";
import { record, text } from "./parsing";

const run = promisify(execFile);
const MAX_CREDENTIAL_BYTES = 1024 * 1024;

export function configHome(
  setting: string | undefined,
  environment: string | undefined,
  fallback: string,
): string {
  const value = setting?.trim() || environment?.trim() || join(homedir(), fallback);
  const expanded =
    value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
  if (!isAbsolute(expanded)) throw new Error("Choose an absolute path for the account directory.");
  return resolve(expanded);
}

export async function readCredentials(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_CREDENTIAL_BYTES) throw new Error("Invalid credential file");
      const buffer = Buffer.alloc(MAX_CREDENTIAL_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > MAX_CREDENTIAL_BYTES) throw new Error("Credential file too large");
      return record(JSON.parse(buffer.subarray(0, length).toString("utf8")));
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (record(error).code === "ENOENT") return undefined;
    throw new Error("Your saved sign-in could not be read. Reopen the provider app and sign in again.");
  }
}

// Only the user's Connect action calls this. Automatic refresh never invokes Keychain tools.
export async function claudeKeychain(): Promise<Record<string, unknown>> {
  if (process.platform !== "darwin") throw new ConnectionRequired("Connect Claude Code on your Mac.");
  try {
    const { stdout } = await run(
      "/usr/bin/security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      {
        timeout: 60_000,
        maxBuffer: MAX_CREDENTIAL_BYTES,
        encoding: "utf8",
      },
    );
    return record(JSON.parse(stdout));
  } catch (error) {
    if (record(error).code === 44)
      throw new ConnectionRequired("Sign in to Claude Code first, then choose Connect Claude Code.");
    throw new ConnectionRequired("Connection was not completed. Choose Connect Claude Code to try again.");
  }
}

export function codexToken(value: Record<string, unknown>): { token: string; account?: string } | undefined {
  const tokens = record(value.tokens);
  const token = text(tokens.access_token) || text(tokens.accessToken);
  return token ? { token, account: text(tokens.account_id) || text(tokens.accountId) } : undefined;
}
