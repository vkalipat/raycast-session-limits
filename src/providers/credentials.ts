import { open, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { record, text } from "./parsing";
const run = promisify(execFile);
const MAX_CREDENTIAL_BYTES = 1024 * 1024;
// Static script: service/account are arguments, never interpolated into code.
const KEYCHAIN_READER = `
ObjC.import('Foundation');
ObjC.import('Security');
function run(argv) {
  var interactive = argv[2] === "interactive";
  if (!interactive) $.SecKeychainSetUserInteractionAllowed(false);
  var query = $.NSMutableDictionary.alloc.init;
  query.setObjectForKey(ObjC.castRefToObject($.kSecClassGenericPassword), ObjC.castRefToObject($.kSecClass));
  query.setObjectForKey($(argv[0]), ObjC.castRefToObject($.kSecAttrService));
  if (argv[1]) query.setObjectForKey($(argv[1]), ObjC.castRefToObject($.kSecAttrAccount));
  query.setObjectForKey($(true), ObjC.castRefToObject($.kSecReturnData));
  query.setObjectForKey(ObjC.castRefToObject($.kSecMatchLimitOne), ObjC.castRefToObject($.kSecMatchLimit));
  if (!interactive) query.setObjectForKey(ObjC.castRefToObject($.kSecUseAuthenticationUIFail), ObjC.castRefToObject($.kSecUseAuthenticationUI));
  var result = Ref();
  var status = $.SecItemCopyMatching(query, result);
  if (status !== 0) return JSON.stringify({keychainStatus: status});
  var data = ObjC.castRefToObject(result[0]);
  if (data.length > 1048576) return '{}';
  return ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding));
}`;
export function configHome(
  setting: string | undefined,
  environment: string | undefined,
  fallback: string,
): string {
  const value = setting?.trim() || environment?.trim() || join(homedir(), fallback);
  const expanded =
    value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value;
  if (!isAbsolute(expanded)) throw new Error("Set the credential directory to an absolute path (or ~/path).");
  return resolve(expanded);
}
export async function readCredentials(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const handle = await open(path, "r");
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
    throw new Error(
      "The CLI credential file could not be read. Check its permissions or sign in again in the CLI.",
    );
  }
}
async function keychain(
  service: string,
  account?: string,
  interactive = false,
): Promise<Record<string, unknown> | undefined> {
  if (process.platform !== "darwin") return undefined;
  let value: Record<string, unknown>;
  try {
    const args = [
      "-l",
      "JavaScript",
      "-e",
      KEYCHAIN_READER,
      service,
      account ?? "",
      interactive ? "interactive" : "silent",
    ];
    const { stdout } = await run("/usr/bin/osascript", args, {
      timeout: 15_000,
      maxBuffer: MAX_CREDENTIAL_BYTES,
    });
    value = record(JSON.parse(stdout));
  } catch {
    throw new Error(
      "Keychain could not be read. Open Show Session Limits to allow Keychain access, then refresh.",
    );
  }
  if (value.keychainStatus === -25300) return undefined;
  if (typeof value.keychainStatus === "number")
    throw new Error(
      "Keychain access is unavailable. Unlock your Keychain and open Show Session Limits to allow access.",
    );
  return value;
}
export async function codexKeychain(
  home: string,
  interactive = false,
): Promise<Record<string, unknown> | undefined> {
  const canonical = await realpath(home).catch(() => home);
  const account = `cli|${createHash("sha256").update(canonical).digest("hex").slice(0, 16)}`;
  return keychain("Codex Auth", account, interactive);
}
export async function claudeKeychain(interactive = false): Promise<Record<string, unknown> | undefined> {
  return keychain("Claude Code-credentials", undefined, interactive);
}
export function codexToken(value: Record<string, unknown>): { token: string; account?: string } | undefined {
  const tokens = record(value.tokens);
  const token = text(tokens.access_token) || text(tokens.accessToken);
  return token ? { token, account: text(tokens.account_id) || text(tokens.accountId) } : undefined;
}
