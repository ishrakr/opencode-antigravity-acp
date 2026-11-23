// src/main.ts
import http from "node:http";

// src/quota.ts
import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
var FIVE_HOURS = 5 * 3600;
var DAY = 24 * 3600;
var WEEK = 7 * DAY;
var AGY_TIMEOUT_MS = 15000;
var ERROR_MAX = 2000;
function resolveAgyBinary(env = process.env) {
  const override = env.AGY_BIN?.trim();
  if (override)
    return override;
  const home = env.HOME || os.homedir();
  const candidates = [
    ...(env.PATH ?? "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, "agy")),
    path.join(home, ".local", "bin", "agy"),
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
    resetAt: Number.isFinite(resetAt) ? resetAt : null
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
function runAgyQuota(binary = resolveAgyBinary(), cwd = defaultCwd()) {
  return new Promise((resolve) => {
    execFile(binary, ["-p", "/quota", "--output-format", "json"], { cwd, env: agyEnv(), timeout: AGY_TIMEOUT_MS, maxBuffer: 1e6 }, (error, stdout, stderr) => {
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
  });
}
function defaultCwd() {
  const dir = process.env.OPENCHAMBER_SERVICE_DATA_DIR || path.join(os.tmpdir(), "antigravity-quota");
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
  inFlight ??= runAgyQuota().then((data) => {
    cached = data.ok ? { at: Date.now(), data } : undefined;
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
