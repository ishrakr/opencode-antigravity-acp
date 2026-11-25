#!/usr/bin/env node
// src/cli.ts
import { spawn } from "node:child_process";
import fs3 from "node:fs";
import readline from "node:readline/promises";

// src/acp-client.ts
import fs2 from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// src/accounts.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// src/account-ids.ts
var MAIN_PROVIDER_ID = "antigravity-acp";
var MAIN_ACCOUNT_ID = "main";
var ACCOUNT_PROVIDER_PREFIX = `${MAIN_PROVIDER_ID}-`;
function accountProviderID(accountId) {
  return accountId === MAIN_ACCOUNT_ID ? MAIN_PROVIDER_ID : `${ACCOUNT_PROVIDER_PREFIX}${accountId}`;
}

// src/accounts.ts
var ACCOUNT_APP_DATA_DIR = "antigravity-acp";
var REGISTRY_FILE = "accounts.json";
var NAME_MAX = 40;
var ID_MAX = 32;
function stateDir(env = process.env) {
  const override = env.ANTIGRAVITY_ACP_STATE_DIR?.trim();
  if (override)
    return override;
  const home = env.HOME || os.homedir();
  const stateHome = env.XDG_STATE_HOME?.trim() || path.join(home, ".local", "state");
  return path.join(stateHome, "opencode-antigravity-acp");
}
function registryPath(env = process.env) {
  return path.join(stateDir(env), REGISTRY_FILE);
}
function accountHome(accountId, env = process.env) {
  return path.join(stateDir(env), "accounts", accountId);
}
function isValidId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,31}$/.test(id) && id !== MAIN_ACCOUNT_ID;
}
function readAccounts(env = process.env) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(registryPath(env), "utf8"));
  } catch {
    return [];
  }
  const list = raw?.accounts;
  if (!Array.isArray(list))
    return [];
  const seen = new Set;
  const accounts = [];
  for (const item of list) {
    const id = item?.id;
    const name = item?.name;
    if (!isValidId(id) || seen.has(id) || typeof name !== "string" || !name.trim())
      continue;
    seen.add(id);
    const createdAt = item?.createdAt;
    accounts.push({ id, name: name.trim().slice(0, NAME_MAX), createdAt: typeof createdAt === "number" ? createdAt : 0 });
  }
  return accounts;
}
function writeAccounts(accounts, env = process.env) {
  const file = registryPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 448 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ version: 1, accounts }, null, 2)}
`, { mode: 384 });
  fs.renameSync(tmp, file);
}
function validateAccountName(name) {
  const trimmed = name.trim();
  if (!trimmed)
    throw new Error('Give the account a name, such as "Work".');
  if (trimmed.length > NAME_MAX)
    throw new Error(`Account names have at most ${NAME_MAX} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(trimmed))
    throw new Error("Account names cannot hold control characters.");
  if (trimmed.toLowerCase() === MAIN_ACCOUNT_ID) {
    throw new Error('"main" is your normal agy login; pick another name.');
  }
  return trimmed;
}
function newAccountId(name, taken) {
  const used = new Set(taken);
  used.add(MAIN_ACCOUNT_ID);
  const base = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, ID_MAX - 3).replace(/-+$/, "") || "account";
  if (!used.has(base))
    return base;
  for (let n = 2;; n++) {
    const id = `${base}-${n}`;
    if (!used.has(id))
      return id;
  }
}
function findAccount(accounts, query) {
  const q = query.trim().toLowerCase();
  return accounts.find((a) => a.name.toLowerCase() === q) ?? accounts.find((a) => a.id === q);
}
var FOREIGN_CREDENTIAL_KEYS = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_CLOUD_QUOTA_PROJECT",
  "GOOGLE_GENAI_USE_VERTEXAI",
  "GCLOUD_PROJECT",
  "CLOUDSDK_CORE_PROJECT"
];
function accountAgyEnv(home, base = process.env) {
  const env = {};
  const doomed = new Set(FOREIGN_CREDENTIAL_KEYS);
  for (const [key, value] of Object.entries(base)) {
    if (!doomed.has(process.platform === "win32" ? key.toUpperCase() : key))
      env[key] = value;
  }
  env.GEMINI_HOME = home;
  env.AGY_ACP_FORCE_FILE_STORAGE = "1";
  env.SSH_CONNECTION = base.SSH_CONNECTION || "127.0.0.1 0 127.0.0.1 0";
  return env;
}
var SHARED_USER_CONFIG = [
  ["AGENTS.md"],
  ["GEMINI.md"],
  ["config", "skills.json"],
  ["config", "skills"],
  ["antigravity-cli", "skills"],
  [ACCOUNT_APP_DATA_DIR, "skills"]
];
function prepareAccountHome(accountId, env = process.env) {
  const home = accountHome(accountId, env);
  fs.mkdirSync(path.join(home, ACCOUNT_APP_DATA_DIR), { recursive: true, mode: 448 });
  if (process.platform === "win32")
    return home;
  const userGemini = path.join(env.HOME || os.homedir(), ".gemini");
  for (const segments of SHARED_USER_CONFIG) {
    const target = segments[0] === ACCOUNT_APP_DATA_DIR ? path.join(userGemini, "antigravity-cli", ...segments.slice(1)) : path.join(userGemini, ...segments);
    const link = path.join(home, ...segments);
    try {
      if (!fs.existsSync(target))
        continue;
      fs.lstatSync(link);
      continue;
    } catch {}
    try {
      fs.mkdirSync(path.dirname(link), { recursive: true, mode: 448 });
      fs.symlinkSync(target, link);
    } catch {}
  }
  return home;
}
function isLoginFile(name) {
  return name.endsWith("oauth-token") || name === "acp_token.json";
}
function savedLoginFiles(home) {
  const files = [];
  for (const dir of [home, path.join(home, ACCOUNT_APP_DATA_DIR)]) {
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        if (isLoginFile(name) && fs.lstatSync(file).isFile())
          files.push(file);
      } catch {}
    }
  }
  return files;
}
function hasSavedLogin(home) {
  return savedLoginFiles(home).length > 0;
}

// src/acp-client.ts
function isExecutableFile(filePath) {
  try {
    const stat = fs2.statSync(filePath);
    if (!stat.isFile())
      return false;
    fs2.accessSync(filePath, process.platform === "win32" ? fs2.constants.F_OK : fs2.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function resolveAgyBinary(env = process.env) {
  const override = env.AGY_BIN?.trim();
  if (override)
    return override;
  const candidates = process.platform === "win32" ? ["agy.exe", "agy.cmd", "agy"] : ["agy"];
  const pathDirs = (env.PATH ?? "").split(path2.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    for (const name of candidates) {
      const candidate = path2.join(dir, name);
      if (isExecutableFile(candidate))
        return candidate;
    }
  }
  const home = env.HOME || env.USERPROFILE || os2.homedir();
  const fallbackPaths = process.platform === "win32" ? [
    ...env.LOCALAPPDATA ? [path2.join(env.LOCALAPPDATA, "Programs", "Antigravity", "bin", "agy.exe")] : [],
    ...home ? [path2.join(home, ".local", "bin", "agy.exe")] : []
  ] : [
    ...home ? [path2.join(home, ".local", "bin", "agy"), path2.join(home, "bin", "agy")] : [],
    "/opt/homebrew/bin/agy",
    "/usr/local/bin/agy",
    "/opt/Antigravity/bin/agy",
    "/usr/bin/agy"
  ];
  for (const candidate of fallbackPaths) {
    if (isExecutableFile(candidate))
      return candidate;
  }
  return "agy";
}
var MAX_STDOUT_BUFFER_BYTES = 16 * 1024 * 1024;

// src/cli.ts
var USAGE = `Usage: agy-accounts <command>

  list                   Accounts, their OpenCode provider and whether they are signed in
  add <name>             Add an account, such as "Work", and sign it in
  login <name>           Sign the account in again (or into another Google account)
  logout <name>          Delete the account's saved Google login
  rename <name> <new>    Change the name OpenCode shows
  remove <name> [--yes]  Remove the account and delete its folder

Your normal agy login stays the "Antigravity (ACP)" provider. Each account here
adds a provider such as "Antigravity (Work)" with the same models; pick its
models to use that account in a session. Nothing switches accounts on its own.
Restart OpenCode after adding, renaming or removing an account.`;

class CliError extends Error {
}
function need(accounts, query) {
  if (!query)
    throw new CliError("Name the account.");
  const account = findAccount(accounts, query);
  if (!account) {
    const names = accounts.map((a) => `"${a.name}"`).join(", ");
    throw new CliError(`No account "${query}". ${names ? `Accounts: ${names}.` : "Add one with: agy-accounts add <name>"}`);
  }
  return account;
}
function runLogin(account) {
  const home = prepareAccountHome(account.id);
  const binary = resolveAgyBinary();
  console.log(`Signing in "${account.name}". Open the link agy prints, sign in with the Google account for "${account.name}", then paste the code here.
`);
  return new Promise((resolve) => {
    const child = spawn(binary, ["acp", "--gemini_dir", home, "--app_data_dir", ACCOUNT_APP_DATA_DIR, "--login"], { cwd: home, env: accountAgyEnv(home), stdio: "inherit" });
    child.on("error", (err) => {
      console.error(`Could not start agy (${binary}): ${err.message}. Install the Antigravity CLI or set AGY_BIN.`);
      resolve(false);
    });
    child.on("exit", (code) => resolve(code === 0 && hasSavedLogin(home)));
  });
}
async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
async function main(argv) {
  const [command, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith("--")));
  const args = rest.filter((a) => !a.startsWith("--"));
  const accounts = readAccounts();
  switch (command) {
    case "list":
    case "ls":
    case undefined: {
      if (command === undefined)
        console.log(`${USAGE}
`);
      const rows = [
        ["Main", "antigravity-acp", "your normal agy login (~/.gemini)"],
        ...accounts.map((a) => [
          a.name,
          accountProviderID(a.id),
          hasSavedLogin(accountHome(a.id)) ? "signed in" : "not signed in"
        ])
      ];
      const widths = [0, 1].map((i) => Math.max(...rows.map((r) => r[i].length)));
      for (const r of rows)
        console.log(`${r[0].padEnd(widths[0])}  ${r[1].padEnd(widths[1])}  ${r[2]}`);
      if (accounts.length === 0)
        console.log(`
No extra accounts yet. Add one with: agy-accounts add <name>`);
      return 0;
    }
    case "add": {
      const name = validateAccountName(args.join(" "));
      if (findAccount(accounts, name))
        throw new CliError(`An account named "${name}" already exists.`);
      const account = {
        id: newAccountId(name, accounts.map((a) => a.id)),
        name,
        createdAt: Date.now()
      };
      prepareAccountHome(account.id);
      writeAccounts([...accounts, account]);
      console.log(`Added "${name}" as the OpenCode provider "Antigravity (${name})" (${accountProviderID(account.id)}).`);
      const ok = await runLogin(account);
      console.log(ok ? `
"${name}" is signed in. Restart OpenCode, then pick a model under "Antigravity (${name})".` : `
"${name}" is not signed in yet. Run: agy-accounts login "${name}"`);
      return ok ? 0 : 1;
    }
    case "login": {
      const account = need(accounts, args.join(" "));
      const ok = await runLogin(account);
      console.log(ok ? `
"${account.name}" is signed in.` : `
"${account.name}" is not signed in.`);
      return ok ? 0 : 1;
    }
    case "logout": {
      const account = need(accounts, args.join(" "));
      const files = savedLoginFiles(accountHome(account.id));
      for (const file of files)
        fs3.rmSync(file, { force: true });
      console.log(files.length > 0 ? `Signed out "${account.name}".` : `"${account.name}" had no saved login.`);
      console.log("Sessions already running on it stop working once OpenCode restarts.");
      return 0;
    }
    case "rename": {
      if (args.length !== 2)
        throw new CliError("Usage: agy-accounts rename <name> <new name> (quote names with spaces)");
      const account = need(accounts, args[0]);
      const name = validateAccountName(args[1]);
      const clash = findAccount(accounts, name);
      if (clash && clash.id !== account.id)
        throw new CliError(`An account named "${name}" already exists.`);
      writeAccounts(accounts.map((a) => a.id === account.id ? { ...a, name } : a));
      console.log(`Renamed "${account.name}" to "${name}". Its provider stays ${accountProviderID(account.id)}; restart OpenCode to see the new name.`);
      return 0;
    }
    case "remove":
    case "rm": {
      const account = need(accounts, args.join(" "));
      if (!flags.has("--yes")) {
        if (!process.stdin.isTTY)
          throw new CliError("Add --yes to remove an account without a prompt.");
        const answer = await confirm(`Remove "${account.name}"? This deletes its folder: its Google login and Antigravity's conversations for it.
Type the account name to confirm: `);
        if (answer.toLowerCase() !== account.name.toLowerCase()) {
          console.log("Nothing removed.");
          return 1;
        }
      }
      writeAccounts(accounts.filter((a) => a.id !== account.id));
      fs3.rmSync(accountHome(account.id), { recursive: true, force: true });
      console.log(`Removed "${account.name}". Restart OpenCode; sessions that used it stay readable but can't continue.`);
      return 0;
    }
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      return 0;
    default:
      throw new CliError(`Unknown command "${command}".

${USAGE}`);
  }
}
main(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
  console.error(err instanceof Error ? err.message : String(err));
  if (!(err instanceof CliError))
    console.error(`Accounts file: ${registryPath()}`);
  process.exit(1);
});
