// src/main.ts
import http from "node:http";

// src/quota.ts
import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// ../src/accounts.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ../src/account-ids.ts
var MAIN_PROVIDER_ID = "antigravity-acp";
var MAIN_ACCOUNT_ID = "main";
var ACCOUNT_PROVIDER_PREFIX = `${MAIN_PROVIDER_ID}-`;

// ../src/accounts.ts
var ACCOUNT_APP_DATA_DIR = "antigravity-acp";
var REGISTRY_FILE = "accounts.json";
var NAME_MAX = 40;
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
function readRegistry(env) {
  try {
    return JSON.parse(fs.readFileSync(registryPath(env), "utf8"));
  } catch {
    return;
  }
}
function mainAccountEnabled(env = process.env) {
  return readRegistry(env)?.main?.enabled !== false;
}
function readAccounts(env = process.env) {
  const raw = readRegistry(env);
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
function accountAgyArgs(home) {
  return ["--gemini_dir", home, "--app_data_dir", ACCOUNT_APP_DATA_DIR];
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

// src/quota.ts
var FIVE_HOURS = 5 * 3600;
var DAY = 24 * 3600;
var WEEK = 7 * DAY;
var AGY_TIMEOUT_MS = 15000;
var PARALLEL_READS = 3;
var ERROR_MAX = 2000;
function resolveAgyBinary(env = process.env) {
  const override = env.AGY_BIN?.trim();
  if (override)
    return override;
  const home = env.HOME || os2.homedir();
  const candidates = [
    ...(env.PATH ?? "").split(path2.delimiter).filter(Boolean).map((dir) => path2.join(dir, "agy")),
    path2.join(home, ".local", "bin", "agy"),
    "/opt/homebrew/bin/agy",
    "/usr/local/bin/agy"
  ];
  return candidates.find((c) => existsSync(c)) ?? "agy";
}
function agyEnv() {
  const env = { ...process.env };
  for (const key of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS"])
    delete env[key];
  return env;
}
function windowSeconds(bucket) {
  const w = `${bucket.window ?? ""} ${bucket.id ?? ""}`.toLowerCase();
  if (w.includes("week") || w.includes("7d"))
    return WEEK;
  if (w.includes("5h") || w.includes("five"))
    return FIVE_HOURS;
  if (w.includes("day"))
    return DAY;
  return null;
}
function windowKey(bucket, seconds) {
  if (seconds === WEEK)
    return "weekly";
  if (seconds === FIVE_HOURS)
    return "5h";
  if (seconds === DAY)
    return "daily";
  return (bucket.window || bucket.id || "limit").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
}
function toWindow(bucket, seconds) {
  const remaining = typeof bucket.remaining_fraction === "number" ? bucket.remaining_fraction : null;
  const resetAt = bucket.reset_time ? Date.parse(bucket.reset_time) : Number.NaN;
  return {
    usedPercent: remaining === null ? null : Math.round(Math.min(100, Math.max(0, (1 - remaining) * 100)) * 10) / 10,
    windowSeconds: seconds,
    resetAt: Number.isFinite(resetAt) && resetAt > 0 ? resetAt : null
  };
}
function toUsageData(output) {
  const groups = output.command?.data?.groups ?? [];
  const models = {};
  for (const group of groups) {
    const name = group.name?.trim();
    if (!name || !Array.isArray(group.buckets))
      continue;
    const windows = {};
    for (const bucket of group.buckets) {
      const seconds = windowSeconds(bucket);
      windows[windowKey(bucket, seconds)] = toWindow(bucket, seconds);
    }
    if (Object.keys(windows).length > 0)
      models[name] = { windows };
  }
  if (Object.keys(models).length === 0) {
    return failure(output.response?.trim() ? `agy reported no quota groups: ${output.response.trim()}` : "agy reported no quota groups. Sign in with `agy` and try again.");
  }
  const windows = {};
  for (const model of Object.values(models)) {
    for (const [key, window] of Object.entries(model.windows)) {
      const current = windows[key];
      if (!current || (window.usedPercent ?? -1) > (current.usedPercent ?? -1))
        windows[key] = window;
    }
  }
  return { ok: true, configured: true, usage: { windows, models } };
}
function failure(error) {
  return { ok: false, configured: true, error: error.slice(0, ERROR_MAX), usage: null };
}
function runAgyQuota(binary = resolveAgyBinary(), cwd = defaultCwd(), home) {
  return new Promise((resolve) => {
    const args = ["-p", "/quota", "--output-format", "json", ...home ? accountAgyArgs(home) : []];
    const child = execFile(binary, args, { cwd, env: home ? accountAgyEnv(home, agyEnv()) : agyEnv(), timeout: AGY_TIMEOUT_MS, maxBuffer: 1e6 }, (error, stdout, stderr) => {
      if (error && error.code === "ENOENT") {
        resolve(failure(`agy was not found (${binary}). Install the Antigravity CLI or set AGY_BIN.`));
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {}
      if (!parsed) {
        const detail = (stderr || error?.message || stdout || "no output").trim().split(`
`).slice(-3).join(" ");
        resolve(failure(`agy /quota failed: ${detail}`));
        return;
      }
      if (parsed.status && parsed.status !== "SUCCESS") {
        resolve(failure(`agy /quota answered ${parsed.status}: ${(parsed.response ?? "").trim()}`));
        return;
      }
      resolve(toUsageData(parsed));
    });
    child.stdin?.end();
  });
}
async function readAllQuotas(binary = resolveAgyBinary(), cwd = defaultCwd(), env = process.env) {
  const jobs = [
    ...mainAccountEnabled(env) ? [async () => ({ id: MAIN_ACCOUNT_ID, name: "Main", data: await runAgyQuota(binary, cwd) })] : [],
    ...readAccounts(env).map((account) => async () => {
      const home = accountHome(account.id, env);
      const data = hasSavedLogin(home) ? await runAgyQuota(binary, cwd, home) : failure(`Not signed in. Run: agy-accounts login "${account.name}"`);
      return { id: account.id, name: account.name, data };
    })
  ];
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await jobs[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, jobs.length) }, worker));
  return { accounts: results };
}
function defaultCwd() {
  const dir = process.env.OPENCHAMBER_SERVICE_DATA_DIR || path2.join(os2.tmpdir(), "antigravity-quota");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

// src/main.ts
var port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
var serviceToken = process.env.OPENCHAMBER_SERVICE_TOKEN ?? "";
if (!port || !serviceToken) {
  console.error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
  process.exit(1);
}
var CACHE_MS = 60000;
var inFlight;
var cached;
var readQuota = () => {
  if (cached && Date.now() - cached.at < CACHE_MS)
    return Promise.resolve(cached.data);
  inFlight ??= readAllQuotas().then((data) => {
    cached = data.accounts.some((a) => a.data.ok) ? { at: Date.now(), data } : undefined;
    return data;
  }).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
};
var send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
var server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${serviceToken}`) {
    send(res, 401, { error: "unauthorized" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === "/usage" && req.method === "GET") {
    readQuota().then((data) => send(res, 200, data)).catch(() => send(res, 500, { error: "could not read the quota" }));
    return;
  }
  send(res, 404, { error: "not-found" });
});
server.listen(port, "127.0.0.1");
