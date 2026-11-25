// Extra Antigravity accounts, as in T3 Code: each Google account signs in into
// its own private folder and appears in OpenCode as its own provider. You pick
// the account per session by picking its models; nothing switches accounts on
// its own. Node built-ins only: the `agy-accounts` command and the OpenChamber
// quota extension bundle this file too.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  MAIN_ACCOUNT_ID,
  MAIN_PROVIDER_ID,
  accountIdOfProvider,
  accountProviderID,
  isAntigravityProvider,
} from "./account-ids.js"

export { MAIN_ACCOUNT_ID, MAIN_PROVIDER_ID, accountIdOfProvider, accountProviderID, isAntigravityProvider }

/** agy joins this beneath the account folder; T3 Code uses the same name. */
export const ACCOUNT_APP_DATA_DIR = "antigravity-acp"
const REGISTRY_FILE = "accounts.json"
const NAME_MAX = 40
const ID_MAX = 32

export interface AntigravityAccount {
  readonly id: string
  readonly name: string
  readonly createdAt: number
}

function stateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.ANTIGRAVITY_ACP_STATE_DIR?.trim()
  if (override) return override
  const home = env.HOME || os.homedir()
  const stateHome = env.XDG_STATE_HOME?.trim() || path.join(home, ".local", "state")
  return path.join(stateHome, "opencode-antigravity-acp")
}

export function registryPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(stateDir(env), REGISTRY_FILE)
}

/** The account's private folder: agy's `GEMINI_HOME` and `--gemini_dir`. */
export function accountHome(accountId: string, env: NodeJS.ProcessEnv = process.env): string {
  return path.join(stateDir(env), "accounts", accountId)
}

function isValidId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,31}$/.test(id) && id !== MAIN_ACCOUNT_ID
}

function readRegistry(env: NodeJS.ProcessEnv): unknown {
  try {
    return JSON.parse(fs.readFileSync(registryPath(env), "utf8"))
  } catch {
    return undefined
  }
}

/**
 * Whether the main provider (your normal agy login in ~/.gemini) is offered.
 * On unless turned off with `agy-accounts main off`.
 */
export function mainAccountEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (readRegistry(env) as { main?: { enabled?: unknown } } | undefined)?.main?.enabled !== false
}

/** Accounts in the order they were added. A missing or unreadable file means none. */
export function readAccounts(env: NodeJS.ProcessEnv = process.env): AntigravityAccount[] {
  const raw = readRegistry(env)
  const list = (raw as { accounts?: unknown })?.accounts
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const accounts: AntigravityAccount[] = []
  for (const item of list) {
    const id = (item as any)?.id
    const name = (item as any)?.name
    if (!isValidId(id) || seen.has(id) || typeof name !== "string" || !name.trim()) continue
    seen.add(id)
    const createdAt = (item as any)?.createdAt
    accounts.push({ id, name: name.trim().slice(0, NAME_MAX), createdAt: typeof createdAt === "number" ? createdAt : 0 })
  }
  return accounts
}

export function writeAccounts(
  accounts: readonly AntigravityAccount[],
  env: NodeJS.ProcessEnv = process.env,
  mainEnabled: boolean = mainAccountEnabled(env),
): void {
  const file = registryPath(env)
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  const registry = { version: 1, ...(mainEnabled ? {} : { main: { enabled: false } }), accounts }
  fs.writeFileSync(tmp, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 })
  fs.renameSync(tmp, file)
}

export function validateAccountName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("Give the account a name, such as \"Work\".")
  if (trimmed.length > NAME_MAX) throw new Error(`Account names have at most ${NAME_MAX} characters.`)
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error("Account names cannot hold control characters.")
  if (trimmed.toLowerCase() === MAIN_ACCOUNT_ID) {
    throw new Error("\"main\" is your normal agy login; pick another name.")
  }
  return trimmed
}

/** A stable ID from the name: "Account 1" → "account-1". */
export function newAccountId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  used.add(MAIN_ACCOUNT_ID)
  const base =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, ID_MAX - 3)
      .replace(/-+$/, "") || "account"
  if (!used.has(base)) return base
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`
    if (!used.has(id)) return id
  }
}

/** Finds an account by name (any case) or ID. */
export function findAccount(accounts: readonly AntigravityAccount[], query: string): AntigravityAccount | undefined {
  const q = query.trim().toLowerCase()
  return accounts.find((a) => a.name.toLowerCase() === q) ?? accounts.find((a) => a.id === q)
}

/** Flags that point agy at the account's folder. `agy -p` accepts only the underscore spelling. */
export function accountAgyArgs(home: string): string[] {
  return ["--gemini_dir", home, "--app_data_dir", ACCOUNT_APP_DATA_DIR]
}

/** Credentials that would make agy use another identity than the account's own login. */
const FOREIGN_CREDENTIAL_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_CLOUD_QUOTA_PROJECT",
  "GOOGLE_GENAI_USE_VERTEXAI",
  "GCLOUD_PROJECT",
  "CLOUDSDK_CORE_PROJECT",
]

/**
 * agy 1.5 keeps Google sign-ins in one shared OS keyring entry unless it
 * believes it runs over SSH; then it keeps them in a file in the account's
 * folder and signs in with `--login`. T3 Code sets the same variables.
 */
export function accountAgyEnv(home: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  const doomed = new Set(FOREIGN_CREDENTIAL_KEYS)
  for (const [key, value] of Object.entries(base)) {
    if (!doomed.has(process.platform === "win32" ? key.toUpperCase() : key)) env[key] = value
  }
  env.GEMINI_HOME = home
  env.AGY_ACP_FORCE_FILE_STORAGE = "1"
  env.SSH_CONNECTION = base.SSH_CONNECTION || "127.0.0.1 0 127.0.0.1 0"
  return env
}

/** Rules and skills every account shares with your normal `~/.gemini`. */
const SHARED_USER_CONFIG = [
  ["AGENTS.md"],
  ["GEMINI.md"],
  ["config", "skills.json"],
  ["config", "skills"],
  ["antigravity-cli", "skills"],
  [ACCOUNT_APP_DATA_DIR, "skills"],
] as const

/**
 * Creates the account's private folder. Your global rules and skills are
 * linked in from `~/.gemini`, so only the login and MCP settings are separate.
 */
export function prepareAccountHome(accountId: string, env: NodeJS.ProcessEnv = process.env): string {
  const home = accountHome(accountId, env)
  fs.mkdirSync(path.join(home, ACCOUNT_APP_DATA_DIR), { recursive: true, mode: 0o700 })
  if (process.platform === "win32") return home
  const userGemini = path.join(env.HOME || os.homedir(), ".gemini")
  for (const segments of SHARED_USER_CONFIG) {
    const target =
      segments[0] === ACCOUNT_APP_DATA_DIR
        ? path.join(userGemini, "antigravity-cli", ...segments.slice(1))
        : path.join(userGemini, ...segments)
    const link = path.join(home, ...segments)
    try {
      if (!fs.existsSync(target)) continue
      fs.lstatSync(link)
      continue
    } catch {}
    try {
      fs.mkdirSync(path.dirname(link), { recursive: true, mode: 0o700 })
      fs.symlinkSync(target, link)
    } catch {}
  }
  return home
}

function isLoginFile(name: string): boolean {
  return name.endsWith("oauth-token") || name === "acp_token.json"
}

/** Files that hold the account's saved Google login. */
export function savedLoginFiles(home: string): string[] {
  const files: string[] = []
  for (const dir of [home, path.join(home, ACCOUNT_APP_DATA_DIR)]) {
    let names: string[] = []
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      const file = path.join(dir, name)
      try {
        if (isLoginFile(name) && fs.lstatSync(file).isFile()) files.push(file)
      } catch {}
    }
  }
  return files
}

export function hasSavedLogin(home: string): boolean {
  return savedLoginFiles(home).length > 0
}
